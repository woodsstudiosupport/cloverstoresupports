from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import sys

DECLARATIONS = ('ads', 'account', 'offline', 'subscriptions', 'openSource')
DECLARATION_FILES = {key: key for key in DECLARATIONS}
DECLARATION_FILES['openSource'] = 'open-source'
VALUES = {'yes', 'no', 'n/a'}
DATA = ('registry', 'developers', 'reviews', 'collections', 'releases', 'announcements', 'catalogue')


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def validate_declarations(values):
    if not isinstance(values, dict) or set(values) != set(DECLARATIONS):
        raise ValueError('Each listing needs all five declaration fields')
    if any(not isinstance(value, str) or value not in VALUES for value in values.values()):
        raise ValueError('Declarations must be yes, no or n/a')


def metadata_for(registry, metadata):
    if metadata.get('schemaVersion') != 1 or not isinstance(metadata.get('apps'), dict):
        raise ValueError('Invalid app metadata document')

    apps = {}
    for listing in registry:
        app_id = listing['id']
        record = dict(metadata['apps'].get(app_id, {}))
        record.setdefault('declarations', dict.fromkeys(DECLARATIONS, 'n/a'))
        validate_declarations(record['declarations'])
        apps[app_id] = record
    return {'schemaVersion': 1, 'apps': apps}


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
    revision = sys.argv[2] if len(sys.argv) > 2 else subprocess.check_output(
        ['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True
    ).strip()
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Expected a full Git commit SHA')
    data = {name: read(root / (name + '.json')) for name in DATA}
    data['appMetadata'] = metadata_for(data['registry'], read(root / 'e3/content/app-metadata.json'))
    output = Path(sys.argv[3]) if len(sys.argv) > 3 else root / 'e3/content/catalogue-snapshot.json'
    for key, name in DECLARATION_FILES.items():
        write(output.with_name(name + '.json'), {
            app_id: ('partial' if key in record.get('partialDeclarations', [])
                     else record['declarations'][key])
            for app_id, record in data['appMetadata']['apps'].items()
        })
    write(output, {
        'schemaVersion': 1,
        'sourceRevision': revision,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'data': data,
    })


if __name__ == '__main__':
    main()
