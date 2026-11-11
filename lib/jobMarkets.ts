export type JobMarket = {
  slug: string;
  city: string;
  state: string;
  stateSlug: string;
  region: string;
  focus: string;
};

/* Fixed, editorially maintained city markets. These are deliberately separate
 * from live-job locations: a market page explains the local search context,
 * while its role list is refreshed from the open jobs database. */
export const jobMarkets: JobMarket[] = [
  ["new-york-ny", "New York", "New York", "new-york", "Northeast", "transit, bridges, water infrastructure and complex urban construction"],
  ["los-angeles-ca", "Los Angeles", "California", "california", "West Coast", "transportation, water resilience, aviation and seismic design"],
  ["chicago-il", "Chicago", "Illinois", "illinois", "Midwest", "rail, expressway, structural rehabilitation and stormwater work"],
  ["houston-tx", "Houston", "Texas", "texas", "Gulf Coast", "drainage, flood-control, port and industrial infrastructure"],
  ["phoenix-az", "Phoenix", "Arizona", "arizona", "Southwest", "land development, water planning, freeway and utility projects"],
  ["philadelphia-pa", "Philadelphia", "Pennsylvania", "pennsylvania", "bridge rehabilitation, transit, rail and urban water programmes"],
  ["san-antonio-tx", "San Antonio", "Texas", "texas", "South Central", "water systems, roadway expansion, military facilities and site development"],
  ["san-diego-ca", "San Diego", "California", "california", "Southern California", "water reuse, defence-adjacent facilities, transportation and coastal infrastructure"],
  ["dallas-tx", "Dallas", "Texas", "texas", "North Texas", "transportation corridors, aviation, utilities and fast-moving land development"],
  ["austin-tx", "Austin", "Texas", "texas", "Central Texas", "growth infrastructure, water, transportation and public works"],
  ["jacksonville-fl", "Jacksonville", "Florida", "florida", "Southeast", "port, roadway, water and coastal-resilience projects"],
  ["fort-worth-tx", "Fort Worth", "Texas", "texas", "North Texas", "aviation, rail, highways, utilities and industrial development"],
  ["san-jose-ca", "San Jose", "California", "california", "Bay Area", "semiconductor facilities, building systems, transit and utility upgrades"],
  ["columbus-oh", "Columbus", "Ohio", "ohio", "Midwest", "advanced manufacturing, roadway, water and data-centre development"],
  ["charlotte-nc", "Charlotte", "North Carolina", "north-carolina", "Southeast", "transportation, power, commercial development and water infrastructure"],
  ["indianapolis-in", "Indianapolis", "Indiana", "indiana", "Midwest", "logistics, highways, advanced manufacturing and municipal projects"],
  ["san-francisco-ca", "San Francisco", "California", "california", "Bay Area", "transit, seismic retrofit, water resilience and complex building work"],
  ["seattle-wa", "Seattle", "Washington", "washington", "Pacific Northwest", "transit, marine, aviation, clean energy and water projects"],
  ["denver-co", "Denver", "Colorado", "colorado", "Rocky Mountain", "transportation, water resources, airports and mountain-region development"],
  ["washington-dc", "Washington", "District of Columbia", "district-of-columbia", "Mid-Atlantic", "federal facilities, transit, water systems and public infrastructure"],
  ["nashville-tn", "Nashville", "Tennessee", "tennessee", "Southeast", "healthcare facilities, transportation, utilities and fast-growing development"],
  ["oklahoma-city-ok", "Oklahoma City", "Oklahoma", "oklahoma", "Great Plains", "roadway, aviation, water and energy-supporting infrastructure"],
  ["el-paso-tx", "El Paso", "Texas", "texas", "Southwest", "border-region logistics, water, military facilities and transportation"],
  ["boston-ma", "Boston", "Massachusetts", "massachusetts", "Northeast", "transit, higher education, life sciences and coastal resilience"],
  ["portland-or", "Portland", "Oregon", "oregon", "Pacific Northwest", "water, bridges, transit, environmental and sustainable-building work"],
  ["las-vegas-nv", "Las Vegas", "Nevada", "nevada", "Southwest", "hospitality construction, water conservation, transportation and power systems"],
  ["detroit-mi", "Detroit", "Michigan", "michigan", "Great Lakes", "automotive facilities, bridges, roads, water and industrial redevelopment"],
  ["memphis-tn", "Memphis", "Tennessee", "tennessee", "Mid-South", "freight, logistics, aviation, river infrastructure and utilities"],
  ["louisville-ky", "Louisville", "Kentucky", "kentucky", "Ohio Valley", "logistics, manufacturing, roadway, water and river-region projects"],
  ["baltimore-md", "Baltimore", "Maryland", "maryland", "Mid-Atlantic", "port, rail, transit, water and bridge rehabilitation"],
  ["milwaukee-wi", "Milwaukee", "Wisconsin", "wisconsin", "Great Lakes", "water technology, manufacturing, infrastructure renewal and public works"],
  ["albuquerque-nm", "Albuquerque", "New Mexico", "new-mexico", "Southwest", "water resources, laboratories, transportation and public facilities"],
  ["tucson-az", "Tucson", "Arizona", "arizona", "Southwest", "water security, aviation, defence-adjacent facilities and land development"],
  ["fresno-ca", "Fresno", "California", "california", "Central Valley", "water, agriculture-supporting infrastructure, highways and public works"],
  ["sacramento-ca", "Sacramento", "California", "california", "Northern California", "state infrastructure, water resources, transportation and flood protection"],
  ["mesa-az", "Mesa", "Arizona", "arizona", "Phoenix metro", "semiconductor facilities, utilities, water and growth infrastructure"],
  ["atlanta-ga", "Atlanta", "Georgia", "georgia", "Southeast", "transportation, aviation, water systems and commercial construction"],
  ["kansas-city-mo", "Kansas City", "Missouri", "missouri", "Midwest", "freight, rail, highways, water and industrial construction"],
  ["colorado-springs-co", "Colorado Springs", "Colorado", "colorado", "Rocky Mountain", "defence, aerospace, utilities, water and mountain-region development"],
  ["omaha-ne", "Omaha", "Nebraska", "nebraska", "Great Plains", "utilities, transportation, water and manufacturing projects"],
  ["raleigh-nc", "Raleigh", "North Carolina", "north-carolina", "Research Triangle", "life sciences, higher education, utilities and transportation"],
  ["miami-fl", "Miami", "Florida", "florida", "South Florida", "coastal resilience, aviation, transit, water and high-rise construction"],
  ["long-beach-ca", "Long Beach", "California", "california", "Southern California", "port operations, freight corridors, water and transportation infrastructure"],
  ["virginia-beach-va", "Virginia Beach", "Virginia", "virginia", "Hampton Roads", "coastal resilience, military facilities, ports and transportation"],
  ["oakland-ca", "Oakland", "California", "california", "Bay Area", "port, transit, water, environmental and public-works projects"],
  ["minneapolis-mn", "Minneapolis", "Minnesota", "minnesota", "Upper Midwest", "water, transit, healthcare, manufacturing and cold-climate infrastructure"],
  ["tulsa-ok", "Tulsa", "Oklahoma", "oklahoma", "Great Plains", "energy, aviation, water and transportation projects"],
  ["tampa-fl", "Tampa", "Florida", "florida", "Gulf Coast", "water, transportation, port, healthcare and coastal-resilience work"],
  ["arlington-tx", "Arlington", "Texas", "texas", "North Texas", "stadium and entertainment facilities, transportation, utilities and development"],
  ["new-orleans-la", "New Orleans", "Louisiana", "louisiana", "Gulf Coast", "flood protection, ports, water, coastal restoration and infrastructure renewal"],
  ["cleveland-oh", "Cleveland", "Ohio", "ohio", "Great Lakes", "water, bridges, manufacturing, transit and industrial redevelopment"],
].map(([slug, city, state, stateSlug, region, focus]) => ({
  slug,
  city,
  state,
  stateSlug,
  region,
  focus,
}));

export function getJobMarket(slug: string) {
  return jobMarkets.find((market) => market.slug === slug);
}
