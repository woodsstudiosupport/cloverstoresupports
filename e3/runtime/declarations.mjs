export const DECLARATIONS = Object.freeze({
  ads: 'Contains ads',
  account: 'Requires an account',
  offline: 'Works offline',
  subscriptions: 'Offers subscriptions',
  openSource: 'Open source'
});

const values = new Set(['yes', 'no', 'n/a']);
const filters = {
  noAds: ['ads', true],
  noAccount: ['account', true],
  offline: ['offline', false],
  noSubscriptions: ['subscriptions', true],
  openSource: ['openSource', false]
};

export function validateDeclarations(declarations) {
  if (!declarations || typeof declarations !== 'object' || Array.isArray(declarations) ||
      Object.keys(declarations).length !== Object.keys(DECLARATIONS).length ||
      Object.keys(DECLARATIONS).some(key => !values.has(declarations[key]))) {
    throw Error('Provide Yes, No or N/A for each app declaration');
  }
  return declarations;
}

export function declarationEvidence(metadata, filter) {
  const mapping = filters[filter];
  if (!mapping) return null;
  const [key, opposite] = mapping;
  const value = metadata?.declarations?.[key];
  if (value !== 'yes' && value !== 'no') return null;
  return {value: opposite ? value === 'no' : value === 'yes', source: 'publisher'};
}
