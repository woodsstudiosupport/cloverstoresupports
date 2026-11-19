from pathlib import Path
import json,sys,datetime
root=Path(sys.argv[1] if len(sys.argv)>1 else '.');revision=sys.argv[2] if len(sys.argv)>2 else 'f08a3850054cb45443a6e058127a14b9ac0e40c9'
names=['registry','developers','reviews','collections','releases','announcements','catalogue'];data={name:json.loads((root/(name+'.json')).read_text())for name in names}
result={'schemaVersion':1,'sourceRevision':revision,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'data':data}
output=Path(sys.argv[3] if len(sys.argv)>3 else 'content/catalogue-snapshot.json');output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('Wrote E3 catalogue snapshot')
