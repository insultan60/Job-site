export type JobState = {
  slug: string;
  name: string;
};

/* Fixed state routes. All role content is read from the live job database. */
export const jobStates: JobState[] = [
  { slug: "alabama", name: "Alabama" },
  { slug: "alaska", name: "Alaska" },
  { slug: "arizona", name: "Arizona" },
  { slug: "arkansas", name: "Arkansas" },
  { slug: "california", name: "California" },
  { slug: "colorado", name: "Colorado" },
  { slug: "connecticut", name: "Connecticut" },
  { slug: "delaware", name: "Delaware" },
  // DC is a federal district rather than a state, but has its own location page.
  { slug: "washington-dc", name: "Washington, DC" },
  { slug: "texas", name: "Texas" },
  { slug: "florida", name: "Florida" },
  { slug: "georgia", name: "Georgia" },
  { slug: "hawaii", name: "Hawaii" },
  { slug: "idaho", name: "Idaho" },
  { slug: "illinois", name: "Illinois" },
  { slug: "indiana", name: "Indiana" },
  { slug: "iowa", name: "Iowa" },
  { slug: "kansas", name: "Kansas" },
  { slug: "kentucky", name: "Kentucky" },
  { slug: "louisiana", name: "Louisiana" },
  { slug: "maine", name: "Maine" },
  { slug: "maryland", name: "Maryland" },
  { slug: "massachusetts", name: "Massachusetts" },
  { slug: "michigan", name: "Michigan" },
  { slug: "minnesota", name: "Minnesota" },
  { slug: "mississippi", name: "Mississippi" },
  { slug: "missouri", name: "Missouri" },
  { slug: "montana", name: "Montana" },
  { slug: "nebraska", name: "Nebraska" },
  { slug: "nevada", name: "Nevada" },
  { slug: "new-hampshire", name: "New Hampshire" },
  { slug: "new-jersey", name: "New Jersey" },
  { slug: "new-mexico", name: "New Mexico" },
  { slug: "new-york", name: "New York" },
  { slug: "north-carolina", name: "North Carolina" },
  { slug: "north-dakota", name: "North Dakota" },
  { slug: "ohio", name: "Ohio" },
  { slug: "oklahoma", name: "Oklahoma" },
  { slug: "oregon", name: "Oregon" },
  { slug: "pennsylvania", name: "Pennsylvania" },
  { slug: "rhode-island", name: "Rhode Island" },
  { slug: "south-carolina", name: "South Carolina" },
  { slug: "south-dakota", name: "South Dakota" },
  { slug: "tennessee", name: "Tennessee" },
  { slug: "utah", name: "Utah" },
  { slug: "vermont", name: "Vermont" },
  { slug: "virginia", name: "Virginia" },
  { slug: "washington", name: "Washington" },
  { slug: "west-virginia", name: "West Virginia" },
  { slug: "wisconsin", name: "Wisconsin" },
  { slug: "wyoming", name: "Wyoming" },
];

export function getJobState(slug: string) {
  return jobStates.find((state) => state.slug === slug);
}
