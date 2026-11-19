from argparse import ArgumentParser
import os
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory
import zipfile

ANDROID = Path(__file__).resolve().parent
E3 = ANDROID.parent
TOOLS = E3.parent / 'tools'
ICON = ANDROID / 'res/drawable-nodpi/store_foreground.png'
ASSET_ENTRIES = ('index.html', 'runtime', 'ui', 'content')


def run(*args):
    subprocess.run([str(arg) for arg in args], check=True)


def check_sources():
    if not ICON.is_file():
        raise SystemExit(f'Missing Android E3 artwork: {ICON}')
    if not shutil.which('node'):
        raise SystemExit('Install Node.js and put node on PATH.')
    for module in sorted((E3 / 'runtime').glob('*.mjs')):
        run('node', '--check', module)
    run('node', '--test', *sorted((E3 / 'tests').glob('*.test.mjs')))


def assemble(args):
    suffix = '.exe' if os.name == 'nt' else ''
    java_bin = args.java_home / 'bin' if args.java_home else None
    java = java_bin / f'java{suffix}' if java_bin else shutil.which('java')
    javac = java_bin / f'javac{suffix}' if java_bin else shutil.which('javac')
    build_tools = args.sdk / 'build-tools/35.0.0'
    aapt2 = build_tools / f'aapt2{suffix}'
    d8 = build_tools / ('d8.bat' if os.name == 'nt' else 'd8')
    android_jar = args.sdk / 'platforms/android-36/android.jar'
    for tool in (java, javac, aapt2, d8, android_jar, args.bundletool):
        if not tool or not Path(tool).is_file():
            raise SystemExit(f'Missing Android build dependency: {tool or "JDK 21"}')

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix='clover-e3-') as temp:
        build = Path(temp)
        resources, classes, dex = [build / name for name in ('res', 'classes', 'dex')]
        classes.mkdir()
        dex.mkdir()
        shutil.copytree(ANDROID / 'res', resources)
        # The nodpi artwork is the single adaptive foreground source.
        (resources / 'drawable/store_foreground.png').unlink(missing_ok=True)
        for legacy in resources.glob('mipmap-*dpi/store_icon.png'):
            legacy.unlink()
        resources_zip, linked = build / 'resources.zip', build / 'resources.apk'
        run(aapt2, 'compile', '--dir', resources, '-o', resources_zip)
        run(aapt2, 'link', '--proto-format', '-I', android_jar, '--manifest',
            ANDROID / 'AndroidManifest.xml', '--auto-add-overlay', '-o', linked, resources_zip)
        run(javac, '--release', '17', '-classpath', android_jar, '-d', classes,
            *sorted((ANDROID / 'src').rglob('*.java')))
        run(d8, '--release', '--min-api', '26', '--lib', android_jar, '--output', dex,
            *sorted(classes.rglob('*.class')))

        module = build / 'base.zip'
        with zipfile.ZipFile(module, 'w', zipfile.ZIP_DEFLATED) as output:
            with zipfile.ZipFile(linked) as resources_apk:
                for name in resources_apk.namelist():
                    output.writestr('manifest/AndroidManifest.xml' if name == 'AndroidManifest.xml'
                                    else name, resources_apk.read(name))
            for file in sorted(dex.glob('*.dex')):
                output.write(file, 'dex/' + file.name)
            for entry in ASSET_ENTRIES:
                path = E3 / entry
                for file in ([path] if path.is_file() else sorted(path.rglob('*'))):
                    if file.is_file():
                        asset = file.relative_to(E3).as_posix()
                        if asset != 'ui/assets/store-icon.png':
                            output.write(file, 'assets/e3/' + asset)
            output.write(ICON, 'assets/e3/ui/assets/store-icon.png')

        staged_bundle = build / 'clover-store-e3.aab'
        run(java, '-jar', args.bundletool, 'build-bundle', f'--modules={module}', f'--output={staged_bundle}')
        run(java, '-jar', args.bundletool, 'validate', f'--bundle={staged_bundle}')
        shutil.copyfile(staged_bundle, args.output)
    print(args.output)


def main():
    parser = ArgumentParser(description='Check or build the Clover Store E3 Android source.')
    parser.add_argument('--check', action='store_true', help='Run source checks without making a bundle.')
    parser.add_argument('--java-home', type=Path, default=os.environ.get('JAVA_HOME'))
    parser.add_argument('--sdk', type=Path, default=os.environ.get('ANDROID_HOME') or
                        os.environ.get('ANDROID_SDK_ROOT') or TOOLS / 'android')
    parser.add_argument('--bundletool', type=Path, default=TOOLS / 'bundletool.jar')
    parser.add_argument('--output', type=Path, default=E3 / 'CloverStore-2.0-E3-foundation-unsigned.aab')
    args = parser.parse_args()
    check_sources()
    if not args.check:
        assemble(args)


if __name__ == '__main__':
    main()
