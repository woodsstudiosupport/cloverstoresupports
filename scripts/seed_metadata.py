"""One-time additive migration from published registry, never from apps/*.json."""
import hashlib, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
if (ROOT/'developers.json').exists():
 raise SystemExit('Migration already applied; edit profiles through reviewed changes instead of regenerating them.')
def dump(path,data):
 (ROOT/path).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
registry=json.loads((ROOT/'registry.json').read_text())
# Explicit mappings preserve publisher distinctions. Do not infer ownership from package prefixes.
identities={
 'Woods Studio':('woods-studio','Woods Studio'),
 'Woods Studio Labs':('woods-studio-labs','Woods Studio Labs'),
 "WS Toast'ed Studio":('ws-toasted-studio',"WS Toast'ed Studio"),
 'HorizonGate Network':('horizongate-network','HorizonGate Network'),
 "[⛔ Unverified] Skylar's Suite":('skylar-suite',"Skylar's Suite"),
}
profiles=[]
for name in dict.fromkeys(a.get('developer','') for a in registry if a.get('name')):
 if name not in identities:raise ValueError('Map publisher explicitly: '+name)
 id,display=identities[name]
 profile={'id':id,'displayName':display,'legacyNames':[name], 'description':'','icon':None,'banner':None,'website':None,'supportUrl':None,'privacyPolicy':None,'verification':{'status':'unverified','verifiedAt':None}}
 if id=='woods-studio':
  profile['icon']='https://images.squarespace-cdn.com/content/v1/6ab52351cfb6e609df15be60/abbb1732-b0f0-472d-8bf3-31c0716db77c/WoodsStudioLogoNEW.png?format=1500w'
  profile['website']='https://www.woodsstudio.dev/'
 profiles.append(profile)
for app in registry:
 if app.get('name'):app['developerId']=identities[app['developer']][0]
dump(Path('registry.json'),registry)
dump(Path('developers.json'),profiles)
for name in ('releases','announcements'):dump(Path(name+'.json'),[])
collections=[]
for category in dict.fromkeys(a['category'] for a in registry if a.get('name')):
 slug={'HomeUI Apps':'homeui','Splash Desktop':'splash-desktop','Games':'games','App Suite':'app-suite'}[category]
 collections.append({'id':slug,'title':category,'description':'Apps listed in '+category+'.','appIds':[a['id'] for a in registry if a.get('name') and a['category']==category]})
dump(Path('collections.json'),collections)
dump(Path('catalogue.json'),{'schemaVersion':2,'endpoints':{key:key+'.json' for key in ('registry','developers','reviews','releases','announcements','collections')},'refreshIntervalSeconds':30,'installationPolicy':{'supplierDeveloperIds':['woods-studio'],'thirdPartyAndroidPackageIdRequired':True,'androidSignatureValidationRequired':True},'services':{'developerPortal':None,'reviewSubmission':None,'reports':None,'devicePairing':None}})
# Preserve existing malformed rows without allowing additional malformed submissions.
legacy=[]
for app in registry:
 if not app.get('name') or any(not isinstance(v,str) for v in app.get('downloads',{}).values()):
  original={k:v for k,v in app.items() if k!='developerId'}
  digest=hashlib.sha256(json.dumps(original,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
  legacy.append({'id':app['id'],'sha256':digest,'reason':'Existing blank placeholder' if not app.get('name') else 'Existing downloads.isBuiltin boolean; not a download URL'})
dump(Path('compatibility.json'),{'legacyEntries':legacy,'legacyReviewAppIds':['test'],'note':'Only exact historical rows are exempt from strict schema checks. New or edited submissions must pass validation. Do not regenerate this allowlist from untrusted submissions.'})
print(f'{sum(bool(a.get("name")) for a in registry)} published apps, {len(profiles)} developer profiles, {len(collections)} collections. Reviews unchanged.')
