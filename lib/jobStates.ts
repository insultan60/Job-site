export type JobState = {
  slug: string;
  name: string;
  region: string;
  focus: string;
  hiringNote: string;
};

/* Editorial state landing pages. Unlike the live job facets, these pages
 * remain useful even when a particular state's current role count is zero. */
export const jobStates: JobState[] = [
  {
    slug: "california",
    name: "California",
    region: "West Coast",
    focus: "transportation, water resilience, utilities, advanced manufacturing and seismic design",
    hiringNote: "California searches benefit from early clarity on PE licensure, project delivery experience and whether the role needs local agency or utility familiarity.",
  },
  {
    slug: "texas",
    name: "Texas",
    region: "South Central",
    focus: "highways, drainage, water infrastructure, energy, logistics and fast-growing development",
    hiringNote: "Texas roles often move quickly when the brief separates the required discipline from preferred TxDOT, municipal or industrial project experience.",
  },
  {
    slug: "florida",
    name: "Florida",
    region: "Southeast",
    focus: "coastal resilience, water systems, transportation, aviation and construction inspection",
    hiringNote: "Florida job briefs should be specific about field versus office expectations and any state or project-specific inspection credentials.",
  },
  {
    slug: "new-york",
    name: "New York",
    region: "Northeast",
    focus: "transit, bridges, public works, water infrastructure and dense urban construction",
    hiringNote: "Strong New York searches describe the delivery environment clearly, especially live-traffic, transit, public-agency or rehabilitation experience.",
  },
  {
    slug: "illinois",
    name: "Illinois",
    region: "Midwest",
    focus: "transportation, rail, structural rehabilitation, water and advanced manufacturing",
    hiringNote: "Illinois roles should identify any distinct structural licensure, rail coordination or state transportation experience that is genuinely essential.",
  },
  {
    slug: "pennsylvania",
    name: "Pennsylvania",
    region: "Mid-Atlantic",
    focus: "bridge rehabilitation, rail, highways, water systems and energy-supporting infrastructure",
    hiringNote: "Pennsylvania hiring is easier to target when project context, licence requirements and PennDOT or public-agency familiarity are stated up front.",
  },
  {
    slug: "georgia",
    name: "Georgia",
    region: "Southeast",
    focus: "transportation, aviation, water, logistics and commercial development",
    hiringNote: "Georgia searches benefit from a clear distinction between design, construction-phase and field-inspection responsibilities.",
  },
  {
    slug: "north-carolina",
    name: "North Carolina",
    region: "Southeast",
    focus: "life sciences facilities, utilities, water, transportation and research-driven development",
    hiringNote: "North Carolina job descriptions should name the actual sector, software and licence path rather than relying on a broad engineering title.",
  },
  {
    slug: "arizona",
    name: "Arizona",
    region: "Southwest",
    focus: "water planning, land development, transportation, semiconductor facilities and utilities",
    hiringNote: "Arizona roles are clearer when they identify whether water, site development, public works or facility delivery experience is the primary need.",
  },
  {
    slug: "washington",
    name: "Washington",
    region: "Pacific Northwest",
    focus: "transit, marine work, aviation, clean energy, water and environmental infrastructure",
    hiringNote: "Washington searches should explain the project setting and regulatory context, particularly for infrastructure near waterways, ports or public transport.",
  },
];

export function getJobState(slug: string) {
  return jobStates.find((state) => state.slug === slug);
}
