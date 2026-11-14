"""Validate public catalogue data, schema constraints and cross-file relationships."""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]

class InvalidCatalogue(ValueError):
    pass

def read(root, path):
    with (root / path).open(encoding='utf-8') as stream:
        return json.load(stream)

def validate_record(kind, record, root=ROOT):
    schema = read(root, f'schemas/{kind}.schema.json')
    for error in sorted(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(record), key=lambda e: str(list(e.path))):
        raise InvalidCatalogue(f'{kind} {list(error.path)}: {error.message}')
    # URI format validation alone accepts credentials and does not establish HTTPS hosts.
    def walk(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in {'icon','banner','website','homepage','supportUrl','privacyPolicy','url'} and child is not None and child != '':
                    check_url(child)
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
    def check_url(value):
        if not isinstance(value, str):
            raise InvalidCatalogue('URL must be a string')
        try:
            u=urlsplit(value)
            if u.scheme != 'https' or not u.hostname or u.username is not None or u.password is not None or any(ord(c)<33 for c in value):
                raise ValueError()
            u.port
        except ValueError as error:
            raise InvalidCatalogue('URLs must be HTTPS, have a host and contain no credentials or whitespace') from error
    walk(record)
    if kind=='app':
        for value in record['downloads'].values():
            if value:
                check_url(value)
        for shot in record.get('screenshots',[]):
            if isinstance(shot,str):
                check_url(shot)

def app_package_required(app, policy):
    return app['developerId'] not in policy['supplierDeveloperIds']

def validate_app(app, developers, policy, root=ROOT):
    validate_record('app', app, root)
    if app['developerId'] not in developers:
        raise InvalidCatalogue(f"Unknown developerId: {app['developerId']}")
    profile=developers[app['developerId']]
    if app['developer'] not in [profile['displayName'],*profile['legacyNames']]:
        raise InvalidCatalogue('App developer label must match its registered profile')
    if app.get('downloads',{}).get('android') and app_package_required(app,policy):
        import re
        package=app.get('androidPackageName',app.get('packageName',app['id']))
        if not isinstance(package,str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+',package):
            raise InvalidCatalogue('Third-party Android downloads require an Android package ID')

def index(records, kind):
    if not isinstance(records,list):
        raise InvalidCatalogue(kind+' must be an array')
    result={}
    for record in records:
        if not isinstance(record,dict) or not isinstance(record.get('id'),str):
            raise InvalidCatalogue(kind+' entries must be objects with string IDs')
        if record['id'] in result:
            raise InvalidCatalogue(f"Duplicate {kind} ID: {record['id']}")
        result[record['id']]=record
    return result

def validate(root=ROOT):
    manifest=read(root,'catalogue.json')
    expected={name:name+'.json' for name in ('registry','developers','reviews','releases','announcements','collections')}
    if manifest.get('schemaVersion')!=2 or manifest.get('endpoints')!=expected or manifest.get('refreshIntervalSeconds')!=30:
        raise InvalidCatalogue('Invalid catalogue version, endpoints or refresh interval')
    developers=index(read(root,'developers.json'),'developer')
    names={}
    for dev in developers.values():
        for name in {dev['displayName'],*dev['legacyNames']}:
            folded=name.strip().casefold()
            if folded in names and names[folded]!=dev['id']:
                raise InvalidCatalogue('Developer display names and legacy aliases must be unambiguous')
            names[folded]=dev['id']
        validate_record('developer',dev,root)
        verification=dev['verification']
        if (verification['status']=='verified') != (verification['verifiedAt'] is not None):
            raise InvalidCatalogue('Verified developers require a verification timestamp')
    defaults=manifest.get('profileDefaults',{})
    if defaults:
        if set(defaults)!={'icon','banner'}:
            raise InvalidCatalogue('Developer defaults must include icon and banner')
        for name in defaults.values():
            if not isinstance(name,str) or not name.startswith('assets/developers/') or '..' in Path(name).parts or not (root/name).is_file():
                raise InvalidCatalogue('Developer fallback asset is missing or has an unsafe path')
    policy=manifest['installationPolicy']
    if policy.get('thirdPartyAndroidPackageIdRequired') is not True or policy.get('androidSignatureValidationRequired') is not True:
        raise InvalidCatalogue('Installation safety settings must stay enabled')
    suppliers=policy['supplierDeveloperIds']
    if not isinstance(suppliers,list) or len(suppliers)!=len(set(suppliers)) or any(id not in developers for id in suppliers):
        raise InvalidCatalogue('Supplier IDs must refer to distinct registered developers')
    compatibility=read(root,'compatibility.json')
    legacy={r['sha256'] for r in compatibility['legacyEntries']}
    registry=read(root,'registry.json')
    apps=index(registry,'app')
    warnings=[]
    for app in apps.values():
        try:
            validate_app(app,developers,policy,root)
        except InvalidCatalogue:
            original={k:v for k,v in app.items() if k!='developerId'}
            digest=hashlib.sha256(json.dumps(original,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
            if digest not in legacy:
                raise
            # Legacy named listings still require a valid, existing publisher reference.
            if app.get('name'):
                profile=developers.get(app.get('developerId'))
                if profile is None or app.get('developer') not in [profile['displayName'],*profile['legacyNames']]:
                    raise InvalidCatalogue('Legacy listing must retain its registered publisher')
            warnings.append('Preserved historical row: '+app['id'])
    canonical_ids={app['id'] for app in registry if app.get('name')}
    if (root/'apps').exists():
        for path in (root/'apps').glob('*.json'):
            record=read(root,str(path.relative_to(root)))
            if not isinstance(record,dict) or record.get('id') not in canonical_ids:
                raise InvalidCatalogue('Unpublished app records belong in archive/, not apps/')
    for app_id in canonical_ids:
        path='apps/'+app_id+'.json'
        if not (root/path).is_file() or read(root,path)!=apps[app_id]:
            raise InvalidCatalogue('Per-app record differs from registry: '+app_id)
    releases=index(read(root,'releases.json'),'release')
    channels=set()
    for release in releases.values():
        validate_record('release',release,root)
        app=apps.get(release['appId'])
        if not app or not app.get('name'):
            raise InvalidCatalogue('Release refers to an unpublished app')
        key=(release['appId'],release['platform'],release['channel'],release.get('versionCode',release['version']))
        if key in channels:
            raise InvalidCatalogue('Duplicate app/platform/channel release version')
        channels.add(key)
        if release['platform']=='android' and app_package_required(app,policy):
            expected=app.get('androidPackageName',app.get('packageName',app['id']))
            if not release.get('packageName') or release['packageName']!=expected:
                raise InvalidCatalogue('Third-party Android releases require a matching packageName')
    for kind in ('collection','announcement'):
        for record in index(read(root,kind+'s.json'),kind).values():
            validate_record(kind,record,root)
            if record.get('developerId') and record['developerId'] not in developers:
                raise InvalidCatalogue('Unknown developer in '+kind)
            for app_id in record.get('appIds',[]):
                if app_id not in apps or not apps[app_id].get('name'):
                    raise InvalidCatalogue('Unknown or unpublished app in '+kind)
                if record.get('developerId') and apps[app_id]['developerId']!=record['developerId']:
                    raise InvalidCatalogue('Developer '+kind+' links to another developer’s app')
    reviews=read(root,'reviews.json')
    if not isinstance(reviews,dict):
        raise InvalidCatalogue('reviews.json must remain an app-ID keyed object')
    for app_id, records in reviews.items():
        if not isinstance(records,list):
            raise InvalidCatalogue('Review groups must be arrays')
        for review in records:
            validate_record('review',{**review,'appId':app_id},root)
            if review.get('appId',app_id)!=app_id:
                raise InvalidCatalogue('Review appId does not match its group')
        if app_id not in apps:
            if app_id not in compatibility['legacyReviewAppIds']:
                raise InvalidCatalogue('Reviews refer to an unknown app: '+app_id)
            warnings.append('Historical reviews retained for unlisted app: '+app_id)
    return warnings

if __name__=='__main__':
    try:
        for warning in validate():
            print('WARNING:',warning)
        print('Catalogue validation passed.')
    except (InvalidCatalogue,KeyError,ValueError,OSError) as error:
        print('ERROR:',error,file=sys.stderr)
        sys.exit(1)
