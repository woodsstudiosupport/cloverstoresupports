from pathlib import Path
import subprocess,os,zipfile
r=Path(__file__).resolve().parent;project=r.parent;tools=project.parent/'tools';jdk=tools/'jdk-21.0.13.0.2+1';sdk=tools/'android';bt=sdk/'build-tools/35.0.0';android=sdk/'platforms/android-36/android.jar';build=r/'build';build.mkdir(exist_ok=True);env={**os.environ,'JAVA_HOME':str(jdk),'PATH':str(jdk/'bin')+':'+os.environ['PATH']}
def run(args):subprocess.run([str(x)for x in args],check=True,env=env)
for file in (project/'runtime').glob('*.mjs'):run(['node','--check',file])
resources=r/'res'
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
   if p.is_file():out.write(p,'assets/e3/'+str(p.relative_to(project)))
aab=project/'CloverStore-2.0-E3-foundation-unsigned.aab';aab.unlink(missing_ok=True)
run([jdk/'bin/java','-jar',tools/'bundletool.jar','build-bundle','--modules='+str(build/'base.zip'),'--output='+str(aab)])
run([jdk/'bin/java','-jar',tools/'bundletool.jar','validate','--bundle='+str(aab)])
print(aab)
