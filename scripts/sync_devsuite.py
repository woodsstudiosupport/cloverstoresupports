"""Import Windows releases only from sources enrolled by Woods Studio."""
import hashlib
import json
import os
import re
from pathlib import Path
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

from validate_catalogue import ROOT, read, validate

REPO = re.compile(r'[A-Za-z0-9-]+/[A-Za-z0-9_.-]+')
APP_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,199}')
INSTALLER = re.compile(r'[^/\\]+\.(exe|msi|msix)', re.I)
SHA = re.compile(r'sha256:[a-f0-9]{64}')


def release_api(repo, token):
    request = Request(f'https://api.github.com/repos/{repo}/releases/latest', headers={
        'Accept': 'application/vnd.github+json', 'Authorization': f'Bearer {token}',
        'User-Agent': 'Clover-Development-Suite',
    })
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def collect(root, sources, fetch_release):
    registry = read(root, 'registry.json')
    apps = {app['id']: app for app in registry}
    releases = read(root, 'releases.json')
    developers = {dev['id']: dev for dev in read(root, 'developers.json')}
    changed_apps = {}
    changed_releases = False
    seen = set()
    for source in sources:
        app_id, repo = source['appId'], source['repository']
        dev_id, asset_name = source['developerId'], source['asset']
        if (not APP_ID.fullmatch(app_id) or app_id.casefold() == 'null' or app_id in seen
                or not REPO.fullmatch(repo) or any(part in ('.', '..') for part in repo.split('/'))
                or not INSTALLER.fullmatch(asset_name) or dev_id not in developers):
            raise ValueError(f'Invalid approved source for {app_id}')
        seen.add(app_id)
        # Restricted, transferred or supplier listings must be managed outside this importer.
        existing = apps.get(app_id)
        if (dev_id in read(root, 'catalogue.json')['installationPolicy']['supplierDeveloperIds']
                or (existing and (existing.get('developerId') != dev_id
                    or existing.get('isBuiltin')
                    or '[restricted' in (existing.get('description') or '').casefold()))):
            raise ValueError(f'App {app_id} is ineligible for automatic publishing')
        release = fetch_release(repo)
        version = release.get('tag_name')
        if (release.get('draft') is not False or release.get('prerelease') is not False
                or not isinstance(version, str) or not 1 <= len(version) <= 100 or version in ('.', '..')):
            raise ValueError(f'{repo} does not have a valid stable release')
        expected_path = '/' + repo + '/releases/download/' + quote(version, safe='') + '/' + quote(asset_name, safe='')
        assets = [asset for asset in release.get('assets', []) if asset.get('name') == asset_name]
        if len(assets) != 1:
            raise ValueError(f'{repo} must have exactly one asset named {asset_name}')
        asset = assets[0]
        url = urlsplit(asset['browser_download_url'])
        if (url.scheme != 'https' or url.netloc != 'github.com' or url.path != expected_path
                or url.query or url.fragment or not SHA.fullmatch(asset.get('digest') or '')
                or type(asset.get('size')) is not int or asset['size'] <= 0):
            raise ValueError(f'{repo} installer URL, size or SHA-256 is invalid')
        key = [app_id, 'windows', 'stable', version]
        release_id = 'devsuite-' + hashlib.sha256(json.dumps(key).encode()).hexdigest()
        entry = {
            'id': release_id, 'appId': app_id, 'platform': 'windows', 'channel': 'stable',
            'version': version, 'url': asset['browser_download_url'], 'sha256': asset['digest'][7:],
            'sizeBytes': asset['size'], 'publishedAt': release['published_at'],
            'changelog': (release.get('body') or '')[:20000],
        }
        previous = next((old for old in releases if
            [old['appId'], old['platform'], old['channel'], old['version']] == key), None)
        if previous and (previous['url'] != entry['url'] or previous.get('sha256') != entry['sha256']):
            raise ValueError(f'{app_id} {version} already exists with different installer data')
        if previous:
            continue
        if any(old['appId'] == app_id and old['platform'] == 'windows' and old['channel'] == 'stable'
               and old.get('publishedAt', '') >= entry['publishedAt'] for old in releases):
            continue
        app = {
            **(existing or {}), 'id': app_id, 'developerId': dev_id,
            'developer': developers[dev_id]['displayName'], 'isBuiltin': False,
            'name': source['name'], 'description': source['description'], 'category': source['category'],
            'icon': source['icon'], 'version': version,
            'downloads': {**(existing or {}).get('downloads', {}), 'windows': entry['url']},
        }
        apps[app_id] = app
        changed_apps[app_id] = app
        releases.append(entry)
        changed_releases = True
    if not changed_releases:
        return {}
    return {'registry.json': list(apps.values()), 'releases.json': releases,
            **{f'apps/{app_id}.json': app for app_id, app in changed_apps.items()}}


def main():
    sources = read(ROOT, 'devsuite-sources.json')
    if not isinstance(sources, list):
        raise ValueError('DevSuite sources must be an array')
    updates = collect(ROOT, sources, lambda repo: release_api(repo, os.environ['GH_TOKEN']))
    if not updates:
        return
    for path, record in updates.items():
        (ROOT / path).write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    validate(ROOT)


if __name__ == '__main__':
    main()
