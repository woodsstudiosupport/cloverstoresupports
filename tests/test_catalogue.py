import copy
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from validate_catalogue import ROOT, InvalidCatalogue, read, validate, validate_app, validate_record
from publish_submission import PUBLIC_FILES, prepare_submission, write_updates

class CatalogueTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        for name in PUBLIC_FILES:
            shutil.copyfile(ROOT/name,self.root/name)
        shutil.copytree(ROOT/'schemas',self.root/'schemas')
        shutil.copytree(ROOT/'apps',self.root/'apps')
        shutil.copytree(ROOT/'assets',self.root/'assets')
    def save(self,name,data):
        (self.root/name).write_text(json.dumps(data))
    def issue(self,kind,data,approved=True):
        return {'title':f'[{kind.title()} Submission] Example','labels':[{'name':'approved'}] if approved else [],'body':'```json\n'+json.dumps(data)+'\n```'}
    def app(self):
        app=copy.deepcopy(next(a for a in read(self.root,'registry.json') if a.get('name')))
        app.update(id='com.example.app',name='New app',developerId='horizongate-network',developer='HorizonGate Network',downloads={'android':'https://example.com/app.apk'})
        return app
    def test_current_catalogue_has_no_compatibility_warnings(self):
        warnings=validate(self.root)
        self.assertEqual([],warnings)
    def test_missing_profile_default_asset_rejected(self):
        (self.root/'assets/developers/default-icon.png').unlink()
        with self.assertRaises(InvalidCatalogue):validate(self.root)
    def test_missing_per_app_record_rejected(self):
        app=read(self.root,'registry.json')[0]
        (self.root/'apps'/f"{app['id']}.json").unlink()
        with self.assertRaises(InvalidCatalogue):validate(self.root)
    def test_different_per_app_record_rejected(self):
        app=read(self.root,'registry.json')[0]
        app['name']='Different name'
        self.save('apps/'+app['id']+'.json',app)
        with self.assertRaises(InvalidCatalogue):validate(self.root)
    def test_unpublished_record_rejected_in_active_apps(self):
        self.save('apps/unpublished.json',{'id':'unpublished'})
        with self.assertRaises(InvalidCatalogue):validate(self.root)
    def test_unknown_developer_rejected(self):
        apps=read(self.root,'registry.json');apps[0]['developerId']='not-registered';self.save('registry.json',apps)
        with self.assertRaises(InvalidCatalogue):validate(self.root)
    def test_new_malformed_row_not_grandfathered(self):
        apps=read(self.root,'registry.json');apps.append({'id':'new-broken'});self.save('registry.json',apps)
        with self.assertRaises(InvalidCatalogue):validate(self.root)
    def test_duplicate_app_ids_rejected(self):
        apps=read(self.root,'registry.json');apps.append(apps[0]);self.save('registry.json',apps)
        with self.assertRaises(InvalidCatalogue):validate(self.root)
    def test_approval_required(self):
        with self.assertRaises(InvalidCatalogue):prepare_submission(self.root,self.issue('app',self.app(),False),1)
    def test_multiple_submission_types_rejected(self):
        issue=self.issue('app',self.app());issue['labels'].append({'name':'review-submission'})
        with self.assertRaises(InvalidCatalogue):prepare_submission(self.root,issue,1)
    def test_app_publish_preserves_other_apps_and_reviews(self):
        before=read(self.root,'registry.json');reviews=(self.root/'reviews.json').read_bytes()
        kind,updates=prepare_submission(self.root,self.issue('app',self.app()),2)
        write_updates(self.root,updates)
        after=read(self.root,'registry.json')
        self.assertEqual('app',kind);self.assertEqual(before,after[:-1]);self.assertEqual(reviews,(self.root/'reviews.json').read_bytes())
        self.assertEqual(after[-1],read(self.root,'apps/com.example.app.json'))
    def test_path_traversal_id_rejected_without_writes(self):
        app=self.app();app['id']='../../README'
        with self.assertRaises(InvalidCatalogue):prepare_submission(self.root,self.issue('app',app),3)
        self.assertFalse((self.root/'apps/README.json').exists())
    def test_http_download_rejected(self):
        app=self.app();app['downloads']['android']='http://example.com/app.apk'
        with self.assertRaises(InvalidCatalogue):prepare_submission(self.root,self.issue('app',app),4)
    def test_url_credentials_rejected(self):
        app=self.app();app['downloads']['android']='https://user:password@example.com/app.apk'
        with self.assertRaises(InvalidCatalogue):prepare_submission(self.root,self.issue('app',app),4)
    def test_supplier_exemption_uses_stable_id_not_claimed_name(self):
        app=self.app();app['id']='supplier-app';app['developer']='Woods Studio'
        with self.assertRaises(InvalidCatalogue):prepare_submission(self.root,self.issue('app',app),5)
        app['developerId']='woods-studio'
        _,updates=prepare_submission(self.root,self.issue('app',app),5)
        self.assertEqual('supplier-app',updates['registry.json'][-1]['id'])
    def test_claimed_publisher_name_is_replaced_by_registered_name(self):
        app=self.app();app['developer']='Woods Studio'
        _,updates=prepare_submission(self.root,self.issue('app',app),5)
        self.assertEqual('HorizonGate Network',updates['registry.json'][-1]['developer'])
    def test_ambiguous_profile_alias_rejected(self):
        issue=self.issue('developer',{'id':'new-studio','displayName':'New Studio','legacyNames':['Woods Studio']})
        with self.assertRaises(InvalidCatalogue):prepare_submission(self.root,issue,5)
    def test_third_party_can_have_distinct_listing_and_package_ids(self):
        app=self.app();app['id']='example-listing';app['androidPackageName']='com.example.realapp'
        _,updates=prepare_submission(self.root,self.issue('app',app),6)
        self.assertEqual('com.example.realapp',updates['registry.json'][-1]['androidPackageName'])
    def test_review_publish_is_idempotent(self):
        data={'appId':'com.woodsstudio.prism.news','name':'Reviewer','rating':5,'comment':'A review'}
        issue=self.issue('review',data)
        for _ in range(2):
            _,updates=prepare_submission(self.root,issue,7,now='2026-11-14T12:00:00Z');write_updates(self.root,updates)
        rows=read(self.root,'reviews.json')[data['appId']]
        self.assertEqual(1,sum(r.get('submissionId')=='github-issue-7' for r in rows))
        self.assertEqual('2026-11-14T12:00:00Z',rows[0]['date'])
    def test_invalid_rating_rejected(self):
        data={'appId':'com.woodsstudio.prism.news','name':'Reviewer','rating':6,'comment':'A review'}
        with self.assertRaises(InvalidCatalogue):prepare_submission(self.root,self.issue('review',data),8)
    def test_review_for_unknown_app_rejected(self):
        data={'appId':'unknown','name':'Reviewer','rating':5,'comment':'A review'}
        with self.assertRaises(InvalidCatalogue):prepare_submission(self.root,self.issue('review',data),8)
    def test_new_profile_defaults_to_unverified(self):
        _,updates=prepare_submission(self.root,self.issue('developer',{'id':'new-studio','displayName':'New Studio'}),9)
        profile=updates['developers.json'][-1]
        self.assertEqual({'status':'unverified','verifiedAt':None},profile['verification'])
        self.assertIsNone(profile['banner'])
    def test_profile_cannot_self_award_badge(self):
        data={'id':'new-studio','displayName':'New Studio','verification':{'status':'verified','verifiedAt':'2026-11-14T12:00:00Z'}}
        with self.assertRaises(InvalidCatalogue):prepare_submission(self.root,self.issue('developer',data),10)
    def test_android_release_requires_numeric_version_code(self):
        release={'id':'test-release','appId':'com.woodsstudio.prism.news','platform':'android','channel':'stable','version':'1','url':'https://example.com/a.apk','packageName':'com.woodsstudio.prism.news'}
        self.save('releases.json',[release])
        with self.assertRaises(InvalidCatalogue):validate(self.root)
    def test_third_party_release_package_must_match_listing(self):
        release={'id':'test-release','appId':'com.woodsstudio.prism.news','platform':'android','channel':'stable','version':'1','versionCode':1,'url':'https://example.com/a.apk','packageName':'com.example.wrong'}
        self.save('releases.json',[release])
        with self.assertRaises(InvalidCatalogue):validate(self.root)
    def test_developer_collection_cannot_claim_other_apps(self):
        rows=read(self.root,'collections.json');rows[0]['developerId']='horizongate-network';self.save('collections.json',rows)
        with self.assertRaises(InvalidCatalogue):validate(self.root)
    def test_unknown_announcement_app_rejected(self):
        self.save('announcements.json',[{'id':'notice','developerId':'woods-studio','title':'Notice','body':'Hello','publishedAt':'2026-11-14T12:00:00Z','appIds':['not-an-app']}])
        with self.assertRaises(InvalidCatalogue):validate(self.root)
    def test_unknown_review_group_not_added_to_legacy_allowlist(self):
        rows=read(self.root,'reviews.json');rows['new-orphan']=[];self.save('reviews.json',rows)
        with self.assertRaises(InvalidCatalogue):validate(self.root)
    def test_duplicate_release_versions_rejected(self):
        release={'id':'release-one','appId':'com.woodsstudio.prism.news','platform':'android','channel':'stable','version':'1','versionCode':1,'url':'https://example.com/a.apk','packageName':'com.woodsstudio.prism.news'}
        self.save('releases.json',[release,{**release,'id':'release-two'}])
        with self.assertRaises(InvalidCatalogue):validate(self.root)

if __name__=='__main__':unittest.main()
