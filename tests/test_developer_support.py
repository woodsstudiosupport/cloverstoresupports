"""Developer support links may be HTTPS or a single explicit email recipient."""
import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from validate_catalogue import ROOT, InvalidCatalogue, read, validate_record

class DeveloperSupportTests(unittest.TestCase):
    def profile(self):
        return copy.deepcopy(read(ROOT,'developers.json')[0])
    def test_all_current_profiles_pass_schema_and_url_checks(self):
        for profile in read(ROOT,'developers.json'):
            with self.subTest(developer=profile['id']):
                validate_record('developer',profile)
    def test_single_recipient_email_supported(self):
        profile=self.profile();profile['supportUrl']='mailto:support.woodsstudio@gmail.com'
        validate_record('developer',profile)
    def test_https_support_remains_supported(self):
        profile=self.profile();profile['supportUrl']='https://example.com/support'
        validate_record('developer',profile)
    def test_email_headers_and_multiple_recipients_rejected(self):
        for value in ('mailto:test@example.com?bcc=other@example.com', 'mailto:test@example.com%0D%0ABcc:other@example.com', 'mailto:a@example.com,b@example.com', 'mailto:a@example.com;b@example.com'):
            with self.subTest(value=value):
                profile=self.profile();profile['supportUrl']=value
                with self.assertRaises(InvalidCatalogue):validate_record('developer',profile)
    def test_other_url_fields_stay_https_only(self):
        for field in ('icon','banner','website','privacyPolicy'):
            with self.subTest(field=field):
                profile=self.profile();profile[field]='mailto:support@example.com'
                with self.assertRaises(InvalidCatalogue):validate_record('developer',profile)
    def test_unsafe_support_urls_rejected(self):
        for value in ('javascript:alert(1)','http://example.com/support','https://user:pass@example.com/support','mailto:invalid'):
            with self.subTest(value=value):
                profile=self.profile();profile['supportUrl']=value
                with self.assertRaises(InvalidCatalogue):validate_record('developer',profile)

if __name__=='__main__':unittest.main()
