from pathlib import Path
import subprocess,os,zipfile,shutil
r=Path(__file__).resolve().parent;project=r.parent;tools=project.parent/'tools';jdk=tools/'jdk-21.0.13.0.2+1';sdk=tools/'android';bt=sdk/'build-tools/35.0.0';android=sdk/'platforms/android-36/android.jar';build=r/'build';build.mkdir(exist_ok=True);env={**os.environ,'JAVA_HOME':str(jdk),'PATH':str(jdk/'bin')+':'+os.environ['PATH']}
def run(args):subprocess.run([str(x)for x in args],check=True,env=env)
for file in (project/'runtime').glob('*.mjs'):run(['node','--check',file])
icon=project.parent/'web/assets/store-icon.png'
if not icon.is_file():
 raise SystemExit('Checkout web/assets/store-icon.png before building E3')
resources=build/'res'
if resources.exists():shutil.rmtree(resources)
shutil.copytree(r/'res',resources)
shutil.copyfile(icon,resources/'drawable'/'store_foreground.png')
for folder in resources.glob('mipmap-*dpi'):
 if folder.name!='mipmap-anydpi':(folder/'store_icon.png').unlink(missing_ok=True)

run([bt/'aapt2','compile','--dir',resources,'-o',build/'resources.zip'])
run([bt/'aapt2','link','--proto-format','-I',android,'--manifest',r/'AndroidManifest.xml','--auto-add-overlay','-o',build/'resources.apk',build/'resources.zip'])
classes=build/'classes';classes.mkdir(exist_ok=True);dex=build/'dex';dex.mkdir(exist_ok=True)
run([jdk/'bin/javac','--release','17','-classpath',android,'-d',classes,*list((r/'src').rglob('*.java'))])
run([bt/'d8','--release','--min-api','26','--lib',android,'--output',dex,*list(classes.rglob('*.class'))])
with zipfile.ZipFile(build/'base.zip','w',zipfile.ZIP_DEFLATED)as out:
 with zipfile.ZipFile(build/'resources.apk')as resources:
  for name in resources.namelist():out.writestr('manifest/AndroidManifest.xml'if name=='AndroidManifest.xml'else name,resources.read(name))
 for p in dex.glob('*.dex'):out.write(p,'dex/'+p.name)
 for path in ['index.html','runtime','ui','content']:
  entry=project/path
  for p in ([entry]if entry.is_file()else entry.rglob('*')):
   if p.is_file():
    asset=p.relative_to(project).as_posix()
    out.write(icon if asset=='ui/assets/store-icon.png' else p,'assets/e3/'+asset)
aab=project/'CloverStore-2.0-E3-foundation-unsigned.aab';aab.unlink(missing_ok=True)
run([jdk/'bin/java','-jar',tools/'bundletool.jar','build-bundle','--modules='+str(build/'base.zip'),'--output='+str(aab)])
run([jdk/'bin/java','-jar',tools/'bundletool.jar','validate','--bundle='+str(aab)])
print(aab)
