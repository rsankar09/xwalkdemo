```javascript
/*
 * Footer block.
 *
 * Footer content is hardcoded below. This can later be replaced with
 * loadFragment() when the footer document is available.
 */

const ONETRUST_HREF = '#ot-sdk-show-settings';
const ONETRUST_ID = 'onetrust-privacy-choices';

const isHeading = (el) => /^H[1-6]$/.test(el.tagName);

/*
 * Hardcoded footer content.
 *
 * Each top-level <div class="section"> represents one footer section.
 * The last section is the legal section.
 */
const FOOTER_HTML = `
 <div class="section">
  <h2>GET IN TOUCH</h2>
  <ul>
    <li><a href="/contact-us" title="Contact New York Life">Contact us</a></li>
    <li><a href="/leads-agents/contact-a-financial-specialist" title="Connect with a New York Life agent">Connect with an agent</a></li>
    <li><a href="/agents/find-an-agent/locator" title="Search for a New York Life agent">Find an agent</a></li>
    <li><a href="/agents" title="Working with a New York Life agent">How an agent can help</a></li>
    <li><a href="/agents/find-an-agent" title="Look for New York Life agents by state">Agent directory</a></li>
    <li><a href="/careers/financial-professionals/find-a-recruiter" title="Look for New York Life recruiters by state">Recruiter directory</a></li>
    <li><a href="/careers/our-offices" title="Look for New York Life offices by state">General office directory</a></li>
  </ul>

  <h2>NEW YORK LIFE</h2>
  <ul>
    <li><a href="/careers/financial-professionals" title="Learn about agent careers">Agent careers</a></li>
    <li><a href="/careers/corporate" title="Learn about corporate careers">Corporate careers</a></li>
    <li><a href="/about/corporate-governance" title="Review corporate governance">Corporate governance</a></li>
    <li><a href="/about/corporate-social-responsibility" title="Learn about corporate social responsibility">Corporate responsibility</a></li>
    <li><a href="/about/financial-information" title="See financial information about New York Life">Financial information</a></li>
    <li><a href="/foundation" title="Learn about the New York Life Foundation">New York Life Foundation</a></li>
    <li><a href="https://www.nylventures.com" title="Go to New York Life Ventures">New York Life Ventures</a></li>
    <li><a href="/report-to-policy-owners" title="Learn about our financial strength">Our financial strength</a></li>
    <li><a href="/newsroom" title="Visit the New York Life newsroom">Newsroom</a></li>
  </ul>
</div>

<div class="section">
  <h2>ACCOUNT</h2>
  <ul>
    <li><a href="https://www.mynyl.newyorklife.com/VSCRegWebApp/login" title="Log in to your New York Life account">Log in</a></li>
    <li><a href="https://www.guestpay.newyorklife.com/mynyl-guest-payments/" title="Make a payment on your policy">Make a payment</a></li>
    <li><a href="/my-account/service-forms-selection" title="Access service forms">Service forms</a></li>
    <li><a href="/claims" title="Start or review claims">Start a claim</a></li>
    <li><a href="http://www.mynyl.com/mobile" title="Download our app">Download our app</a></li>
  </ul>

  <h2>PRODUCTS AND SERVICES</h2>
  <ul>
    <li><a href="/products/insurance" title="Learn more about our insurance options">Insurance</a></li>
    <li><a href="/products/insurance/life-insurance" title="Learn about our life insurance options">Life insurance</a></li>
    <li><a href="/products/insurance/term-life" title="Learn about term life insurance">Term life insurance</a></li>
    <li><a href="/products/insurance/whole-life" title="Learn about whole life insurance">Whole life insurance</a></li>
    <li><a href="/products/insurance/long-term-care-insurance" title="Learn about long-term care insurance">Long-term care insurance</a></li>
    <li><a href="/products/insurance/individual-disability-insurance" title="Learn about individual disability insurance">Individual disability insurance</a></li>
    <li><a href="/products/investments" title="Learn about our investment options">Investments</a></li>
    <li><a href="/products/investments/annuities" title="Learn about our annuities">Annuities</a></li>
    <li><a href="/products/investments/college-savings-529-plans" title="Learn about 529 college savings plans">529 college savings plans</a></li>
    <li><a href="/products/advisory-services/wealth-management" title="Learn about wealth management">Wealth management</a></li>
    <li><a href="/products/advisory-services/estate-planning" title="Learn about estate planning">Estate planning</a></li>
    <li><a href="/products/advisory-services/small-business-services" title="Learn more about Small business">Small business</a></li>
  </ul>
</div>

<div class="section">
  <h2>INSTITUTIONAL &amp; EMPLOYER SOLUTIONS</h2>
  <ul>
    <li><a href="/guaranteed-products/medium-term-notes" title="Go to Global Medium Term Notes">Medium term notes</a></li>
    <li><a href="/guaranteed-products/pension-risk-transfer" title="Learn about Pension Risk Transfer">Pension risk transfer</a></li>
    <li><a href="https://www.newyorklifeinvestments.com/investment-products/stable-value-funds" title="Learn about Stable Value Investments">Stable value investments</a></li>
    <li><a href="/amn/institutional-life" title="Learn about Bank and Corporate-Owned Life Insurance">Bank and corporate-owned life insurance</a></li>
    <li><a href="/group-benefit-solutions/employers" title="Learn more about Group Insurance Solutions for Employers">Group insurance solutions for employers</a></li>
    <li><a href="/group-benefit-solutions/producers" title="Learn more about Group Insurance Solutions for Associations">Group insurance solutions for associations</a></li>
    <li><a href="/products/investments" title="Learn more about Investments">Investments</a></li>
  </ul>

  <h2>INSTITUTIONAL BUSINESSES</h2>
  <ul>
    <li><a href="https://www.nylim.com" title="Learn more about New York Life Investment Management">New York Life Investment Management</a></li>
    <li><a href="/group-benefit-solutions" title="Learn more about New York Life Group Benefit Solutions">New York Life Group Benefit Solutions</a></li>
    <li><a href="https://www.nylaarp.com/" title="Learn about New York Life Direct">New York Life Direct</a></li>
    <li><a href="/groupmembership" title="Learn more about Group Membership Association Division">Group Membership Association Division</a></li>
    <li><a href="/guaranteed-products/institutional-retirement-and-risk-solutions" title="Learn more about Institutional Retirement &amp; Risk Solutions">Institutional Retirement &amp; Risk Solutions</a></li>
    <li><a href="/amn/institutional-life" title="Learn more about Institutional Life">Institutional Life</a></li>
    <li><a href="https://www.mnyl.com.mx/" title="Learn more about New York Life Seguros Monterrey">New York Life Seguros Monterrey</a></li>
  </ul>
</div>

<div class="section">
  <div class="email-subscribe">
    <div>
      <div>
        <p>SUBSCRIBE</p>
        <p>Receive resources &amp; tools that can help you prepare for the future. You can cancel anytime.</p>
      </div>
      <div>
        <p><a href="">Subscribe</a></p>
        <p>Email address</p>
      </div>
    </div>
  </div>

  <h2>Follow us</h2>
  <ul>
    <li>
      <a href="https://twitter.com/NewYorkLife" title="Visit New York Life on Twitter">
        <span class="icon icon-x"></span>
      </a>
    </li>
    <li>
      <a href="https://www.facebook.com/newyorklife/" title="Visit New York Life on Facebook">
        <span class="icon icon-facebook"></span>
      </a>
    </li>
    <li>
      <a href="https://www.linkedin.com/company/newyorklife" title="Visit New York Life on LinkedIn">
        <span class="icon icon-linkedin"></span>
      </a>
    </li>
    <li>
      <a href="https://www.instagram.com/newyorklife/" title="Visit New York Life on Instagram">
        <span class="icon icon-instagram"></span>
      </a>
    </li>
    <li>
      <a href="https://www.youtube.com/user/newyorklife" title="Visit New York Life on YouTube">
        <span class="icon icon-youtube"></span>
      </a>
    </li>
  </ul>
</div>

<div class="section footer-legal">
  <p>
    <a href="tel:+18002255695">1 (800) CALL-NYL</a>
  </p>

  <p>
    © 2026 New York Life Insurance Company, New York, NY. All Rights Reserved.
    NEW YORK LIFE, and the NEW YORK LIFE Box Logo are trademarks of New York Life Insurance Company.
  </p>

  <ul>
    <li>
      <a href="/about/privacy/terms-of-use" title="Read about our Terms of use">
        Terms of use
      </a>
    </li>
    <li>
      <a href="/about/privacy-policy" title="Read about our Privacy &amp; other policies">
        Privacy &amp; other policies
      </a>
    </li>
    <li>
      <a href="/sitemap" title="Sitemap">
        Sitemap
      </a>
    </li>
    <li>
      <a href="#ot-sdk-show-settings" title="Your Privacy Choices">
        Your California Privacy Choices
        <span class="icon icon-privacy-options"></span>
      </a>
    </li>
  </ul>
</div>
`;

const fragment = document.createElement('div');
fragment.innerHTML = FOOTER_HTML;

/*
 * A list is the social row when every one of its items is an icon-only link.
 */
function isSocialList(el) {
  if (el.tagName !== 'UL') return false;

  const links = [...el.querySelectorAll(':scope > li > a')];

  return links.length > 0
    && links.every((a) => a.querySelector('span.icon'));
}

/*
 * Decorate social media links.
 */
function decorateSocialLink(a) {
  const icon = a.querySelector('span.icon');

  if (!icon) return;

  const iconClass = [...icon.classList]
    .find((c) => c.startsWith('icon-'));

  const iconName = iconClass
    ? iconClass.slice(5).replace(/-/g, ' ')
    : '';

  const label = a.getAttribute('aria-label')
    || a.textContent.trim()
    || a.title
    || iconName;

  a.setAttribute('aria-label', label);
  a.classList.add('footer-social-link');

  a.replaceChildren(icon);
}

/*
 * Turns heading + list into a navigation landmark.
 */
function buildLinkGroup(group) {
  const list = group.find((el) => el.tagName === 'UL');

  if (!list) {
    const text = document.createElement('div');
    text.className = 'footer-column-text';
    text.append(...group);
    return text;
  }

  const heading = isHeading(group[0]) ? group[0] : null;
  const social = isSocialList(list);

  const nav = document.createElement('nav');

  nav.className = social
    ? 'footer-social'
    : 'footer-linklist';

  nav.setAttribute(
    'aria-label',
    heading ? heading.textContent.trim() : 'Footer',
  );

  if (heading) {
    heading.classList.add(
      social
        ? 'footer-social-title'
        : 'footer-linklist-title',
    );

    if (social) {
      heading.classList.add('footer-visually-hidden');
    }
  }

  if (social) {
    list.classList.add('footer-social-list');

    list
      .querySelectorAll(':scope > li > a')
      .forEach(decorateSocialLink);
  } else {
    list.classList.add('footer-linklist-items');
  }

  nav.append(...group);

  return nav;
}

/*
 * Splits column content into heading/list groups.
 */
function decorateColumnContent(wrapper) {
  const groups = [];

  [...wrapper.children].forEach((el) => {
    if (isHeading(el) || !groups.length) {
      groups.push([]);
    }

    groups[groups.length - 1].push(el);
  });

  wrapper.replaceChildren(
    ...groups.map(buildLinkGroup),
  );
}

/*
 * Decorates the legal section.
 */
function decorateLegal(section) {
  section.classList.add('footer-legal');

  const wrapper =
    section.querySelector(':scope > .default-content-wrapper')
    || section.firstElementChild
    || section;

  if (!wrapper) return;

  wrapper.classList.add('footer-legal-inner');

  const paragraphs = [
    ...wrapper.querySelectorAll(':scope > p'),
  ];

  if (paragraphs.length) {
    const meta = document.createElement('div');

    meta.className = 'footer-legal-meta';

    paragraphs.forEach((p) => {
      p.classList.add(
        p.querySelector('a[href^="tel:"]')
          ? 'footer-contact'
          : 'footer-copyright',
      );
    });

    paragraphs[0].replaceWith(meta);
    meta.append(...paragraphs);
  }

  const list = wrapper.querySelector(':scope > ul');

  if (list) {
    const nav = document.createElement('nav');

    nav.className = 'footer-legal-nav';
    nav.setAttribute('aria-label', 'Legal');

    list.replaceWith(nav);

    list.classList.add('footer-legal-links');

    nav.append(list);
  }

  /*
   * OneTrust hook.
   */
  const privacyChoices = wrapper.querySelector(
    `a[href$="${ONETRUST_HREF}"]`,
  );

  if (privacyChoices) {
    privacyChoices.id = ONETRUST_ID;

    privacyChoices.classList.add(
      'ot-sdk-show-settings',
      'footer-privacy-choices',
    );
  }
}

/*
 * Loads and decorates the footer.
 */
export default async function decorate(block) {
  block.textContent = '';

  /*
   * Use the hardcoded fragment.
   *
   * No loadFragment()
   * No loadBundledFragment()
   * No /footer document required.
   */
  const footerFragment = fragment;

  if (!footerFragment) return;

  const sections = [
    ...footerFragment.children,
  ].filter((el) =>
    el.classList.contains('section'),
  );

  /*
   * The last section is legal.
   */
  const legal =
    footerFragment.querySelector(
      ':scope > .section.footer-legal',
    )
    || (
      sections.length > 1
        ? sections[sections.length - 1]
        : null
    );

  const columns = sections.filter(
    (section) => section !== legal,
  );

  /*
   * Footer columns.
   */
  if (columns.length) {
    const grid = document.createElement('div');

    grid.className = 'footer-columns';

    columns.forEach((column) => {
      column.classList.add('footer-column');

      /*
       * Hardcoded HTML doesn't have the EDS
       * .default-content-wrapper, so decorate the
       * section itself when necessary.
       */
      const wrappers = column.querySelectorAll(
        ':scope > .default-content-wrapper',
      );

      if (wrappers.length) {
        wrappers.forEach(decorateColumnContent);
      } else {
        decorateColumnContent(column);
      }

      /*
       * Subscribe/social column becomes aside.
       */
      if (
        column.querySelector(
          '.block, .email-subscribe, .footer-social',
        )
      ) {
        column.classList.add(
          'footer-column-aside',
        );
      }

      grid.append(column);
    });

    block.append(grid);
  }

  /*
   * Legal footer.
   */
  if (legal) {
    decorateLegal(legal);
    block.append(legal);
  }
}