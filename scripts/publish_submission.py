"""Prepare and validate a maintainer-approved issue submission. No credentials here."""
from __future__ import annotations
import datetime
import json
import os
import re
import shutil
import tempfile
from pathlib import Path
from validate_catalogue import ROOT, InvalidCatalogue, read, validate, validate_app, validate_record

PUBLIC_FILES=('catalogue.json','compatibility.json','registry.json','developers.json','reviews.json','releases.json','announcements.json','collections.json')

def prepare_submission(root, issue, number, now=None):
    if type(number) is not int or number < 1:
        raise InvalidCatalogue('Invalid issue number')
    labels={entry['name'] if isinstance(entry,dict) else entry for entry in issue.get('labels',[])}
    if 'approved' not in labels:
        raise InvalidCatalogue('Maintainer approval is required')
    title=issue.get('title','')
    kinds=[kind for kind in ('app','review','developer') if kind+'-submission' in labels or title.startswith('['+kind.title()+' Submission]')]
    if len(kinds)!=1:
        raise InvalidCatalogue('Specify exactly one submission type')
    blocks=re.findall(r'```json\s*\n(.*?)\n```',issue.get('body') or '',flags=re.S|re.I)
    if len(blocks)!=1 or len(blocks[0].encode())>131072:
        raise InvalidCatalogue('Provide one fenced JSON object, at most 128 KiB')
    data=json.loads(blocks[0])
    if not isinstance(data,dict):
        raise InvalidCatalogue('Submission JSON must be an object')
    kind=kinds[0]
    if kind in ('app','developer') and not isinstance(data.get('id'),str):
        raise InvalidCatalogue('A string ID is required')
    if any(key in data for key in ('verification','verified','installationPolicy','supplierPackageIdExempt')):
        raise InvalidCatalogue('Verification and installation policy are maintainer-managed, not submission fields')
    stamp=now or datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
    developers=read(root,'developers.json')
    devs={d['id']:d for d in developers}
    registry=read(root,'registry.json')
    apps={a['id']:a for a in registry}
    policy=read(root,'catalogue.json')['installationPolicy']
    updates={}
    if kind=='review':
        app_id=data.get('appId')
        if app_id not in apps or not apps[app_id].get('name'):
            raise InvalidCatalogue('Reviews must refer to a published app')
        review={**data,'date':stamp,'timestamp':int(datetime.datetime.fromisoformat(stamp.replace('Z','+00:00')).timestamp()*1000),'submissionId':f'github-issue-{number}'}
        validate_record('review',review,root)
        reviews=read(root,'reviews.json')
        duplicate=any(r.get('submissionId')==review['submissionId'] for entries in reviews.values() for r in entries)
        if not duplicate:
            reviews.setdefault(app_id,[]).insert(0,review)
        updates['reviews.json']=reviews
    elif kind=='developer':
        profile={**{'legacyNames':[],'description':'','icon':None,'banner':None,'website':None,'supportUrl':None,'privacyPolicy':None,'verification':{'status':'unverified','verifiedAt':None}},**devs.get(data.get('id'),{}),**data}
        validate_record('developer',profile,root)
        if profile['id'] in devs:
            developers=[profile if d['id']==profile['id'] else d for d in developers]
        else:
            developers.append(profile)
        updates['developers.json']=developers
    else:
        app={**apps.get(data.get('id'),{}),**data}
        dev_id=app.get('developerId')
        if dev_id is None:
            candidates=[d['id'] for d in developers if app.get('developer') in [d['displayName'],*d['legacyNames']]]
            if len(candidates)!=1:
                raise InvalidCatalogue('Provide a registered developerId')
            dev_id=candidates[0]
        if dev_id not in devs:
            raise InvalidCatalogue('Register the developer profile before publishing an app')
        app['developerId']=dev_id
        # Stamp the registered name so legacy clients cannot mistake a claimed name for Woods Studio.
        app['developer']=devs[dev_id]['displayName']
        validate_app(app,devs,policy,root)
        registry=[app if old['id']==app['id'] else old for old in registry]
        if app['id'] not in apps:
            registry.append(app)
        updates['registry.json']=registry
        updates[f"apps/{app['id']}.json"]=app
    # Validate all resulting relationships before modifying any working-tree data.
    with tempfile.TemporaryDirectory() as temp:
        staged=Path(temp)
        for name in PUBLIC_FILES:
            shutil.copyfile(root/name,staged/name)
        shutil.copytree(root/'schemas',staged/'schemas')
        for name,value in updates.items():
            path=staged/name
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        validate(staged)
    return kind,updates

def write_updates(root, updates):
    for name,value in updates.items():
        path=root/name
        path.parent.mkdir(parents=True,exist_ok=True)
        temporary=path.with_suffix(path.suffix+'.tmp')
        temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        temporary.replace(path)

if __name__=='__main__':
    event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    issue=event['issue']
    kind,updates=prepare_submission(ROOT,issue,issue['number'])
    write_updates(ROOT,updates)
    print(f'Validated {kind} submission from issue #{issue["number"]}.')
