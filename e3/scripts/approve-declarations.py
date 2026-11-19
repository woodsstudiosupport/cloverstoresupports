"""Apply a reviewed publisher declaration draft to the checkout."""
import argparse
from pathlib import Path

from snapshot import read, validate_declarations, write


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('draft', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    draft = read(args.draft)
    if not isinstance(draft, dict) or draft.get('format') != 'clover-e3-declarations' or draft.get('version') != 1:
        parser.error('Invalid E3 declaration draft')
    listing_id = draft.get('appId')
    if not any(app['id'] == listing_id for app in read(root / 'registry.json')):
        parser.error('The listing must exist in registry.json before approval')
    declarations = draft.get('declarations')
    try:
        validate_declarations(declarations)
    except ValueError as error:
        parser.error(str(error))

    path = root / 'e3/content/app-metadata.json'
    data = read(path)
    record = data['apps'].setdefault(listing_id, {})
    record['declarations'] = declarations
    temporary = path.with_suffix('.tmp')
    write(temporary, data)
    temporary.replace(path)
    print(f'Updated declarations for {listing_id}. Review and commit {path.relative_to(root)}.')


if __name__ == '__main__':
    main()
