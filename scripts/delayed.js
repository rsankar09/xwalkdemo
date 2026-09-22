// add delayed functionality here

/*
 * OneTrust consent management — third party, kept off the critical path.
 *
 * The footer renders the preference-centre hook as
 * <a id="onetrust-privacy-choices" class="ot-sdk-show-settings">; the SDK
 * binds to that class itself once it loads, so nothing here needs to wait for
 * the footer (loadFooter() is not awaited, so gating on it would race).
 *
 * The domain script id below is the one the source site serves. Confirm it is
 * the correct OneTrust tenant for this project before going to production.
 */
const ONETRUST_DOMAIN_SCRIPT = 'd0fcbdb0-160a-48ef-ae89-6cd26b940beb';

function loadOneTrust() {
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.charset = 'UTF-8';
  script.src = 'https://cdn.cookielaw.org/scripttemplates/otSDKStub.js';
  script.dataset.domainScript = ONETRUST_DOMAIN_SCRIPT;
  document.head.append(script);
}

loadOneTrust();
