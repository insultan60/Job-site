export type StateGuide = {
  summary: string;
  sections: Array<{
    title: string;
    body: string;
  }>;
};

/* Editorial state content. A missing guide is intentional: do not substitute
   generic copy for a researched state resource. */
export const stateGuides: Record<string, StateGuide> = {
  alabama: {
    summary:
      "Alabama's transportation department lists traffic engineering, preliminary engineering and final design among its Design Bureau functions.",
    sections: [
      {
        title: "Transportation engineering",
        body: "Alabama's Design Bureau includes traffic engineering, preliminary engineering and final design divisions.",
      },
      {
        title: "Professional engineering licensure",
        body: "Alabama's engineering board provides the Professional Engineer application process and states that engineering firms must employ a currently licensed Alabama PE.",
      },
    ],
  },
  california: {
    summary:
      "Caltrans manages California highway and freeway lanes, supports intercity rail, and works with local agencies across the state.",
    sections: [
      {
        title: "Transportation systems",
        body: "Caltrans manages more than 50,000 miles of highway and freeway lanes, supports intercity rail and works with local agencies across California.",
      },
      {
        title: "Professional engineering licensure",
        body: "California's engineering board identifies Civil, Electrical and Mechanical Engineering as practice-act branches of PE licensure.",
      },
    ],
  },
  texas: {
    summary:
      "The Texas Department of Transportation describes its work as designing, building, operating and maintaining the state's transportation system with safety as its first priority.",
    sections: [
      {
        title: "Transportation systems",
        body: "TxDOT describes its role as designing, building, operating and maintaining the state's transportation system, with safety as its first priority.",
      },
      {
        title: "Professional engineering licensure",
        body: "Texas licensing guidance covers education, engineering experience, references and the Fundamentals of Engineering examination for PE applicants.",
      },
    ],
  },
};

export function getStateGuide(slug: string) {
  return stateGuides[slug];
}
