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
  alaska: {
    summary: "Alaska transportation work spans roads, aviation, ferries, ports and public facilities across a large and varied geography.",
    sections: [
      { title: "Multimodal systems", body: "Alaska's transportation agency manages aviation, the Alaska Marine Highway System, highways, harbors, transit and statewide planning programs." },
      { title: "Project delivery", body: "Transportation planning and delivery includes community programs, safety, resiliency, rural ports, docks and bridge investment." },
    ],
  },
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
  colorado: {
    summary: "Colorado transportation programs include highway, bridge, transit, rail, aviation and innovative-mobility work across the state.",
    sections: [
      { title: "Bridge infrastructure", body: "Colorado's Bridge Enterprise finances repair, reconstruction and replacement of structurally deficient bridges." },
      { title: "Statewide programs", body: "State transportation planning includes transit and rail grants, aeronautics, environmental programs, express lanes and active transportation." },
    ],
  },
  connecticut: {
    summary:
      "Connecticut carries a concentrated mix of rail, bridge and coastal infrastructure across a compact statewide market.",
    sections: [
      {
        title: "Infrastructure work",
        body: "Much of the work centers on bridge rehabilitation and replacement, interchange reconstruction, coastal movable bridges, drainage and shoreline resilience.",
      },
      {
        title: "Professional engineering licensure",
        body: "Client-facing design roles commonly require a Connecticut PE license or a practical route to licensure through comity.",
      },
    ],
  },
  delaware: {
    summary: "Delaware's transportation system brings together roads, bridges, public transit, freight, aviation, rail and active transportation.",
    sections: [
      { title: "Transportation delivery", body: "Delaware's transportation department designs, constructs and maintains roads and bridges, administers highway operations and operates the statewide public-transit network." },
      { title: "Multimodal planning", body: "State planning supports walking, biking, driving, rail, buses, freight and aviation across Delaware." },
    ],
  },
  florida: {
    summary:
      "Florida's transportation system spans roadway, air, rail, sea, spaceports, transit, bicycle and pedestrian facilities.",
    sections: [
      {
        title: "Transportation delivery",
        body: "Florida's transportation department uses consulting engineers for design engineering, construction engineering and inspection services on transportation projects.",
      },
      {
        title: "Professional development",
        body: "The department's Professional Engineer Training Program gives graduate engineers practical transportation experience toward professional licensure.",
      },
    ],
  },
  "washington-dc": {
    summary: "Washington, DC transportation work includes public transit, bus-priority improvements and a dense urban transportation network.",
    sections: [
      { title: "Transit systems", body: "The District transportation department supports transit services and coordinates with the regional transit authority on Metrobus and Metrorail service in the District." },
      { title: "Mobility programs", body: "District transportation programs include bus-priority projects, bus-shelter improvements and transportation services for residents, workers and visitors." },
    ],
  },
  georgia: {
    summary:
      "Georgia's transportation work includes state and federal roadways, roads and bridges, rail, transit, aviation and active transportation programs.",
    sections: [
      {
        title: "Engineering disciplines",
        body: "Georgia's transportation engineering organization includes roadway design, bridge design and maintenance, environmental services, right of way and design policy support.",
      },
      {
        title: "Multimodal programs",
        body: "The state's transportation department supports planning and financial programs for rail, transit, general aviation, bicycle and pedestrian transportation.",
      },
    ],
  },
  hawaii: {
    summary: "Hawaii transportation programs bring together highways, airports, harbors and public transit across the islands.",
    sections: [
      { title: "Multimodal delivery", body: "Hawaii's transportation department administers statewide multimodal programs and federal transit assistance for Neighbor Island bus agencies and related organizations." },
      { title: "Public transportation", body: "State transit work includes support for rural transportation assistance, bus agencies, planning organizations and paratransit programs." },
    ],
  },
  idaho: {
    summary: "Idaho transportation work is organized through statewide programs and six regional transportation districts.",
    sections: [
      { title: "Regional delivery", body: "Idaho's transportation department delivers development, construction and maintenance guidance through regional offices across the state." },
      { title: "Public transportation", body: "The state's public transportation office provides grants and technical assistance to local transit programs." },
    ],
  },
  iowa: {
    summary: "Iowa transportation work includes statewide project delivery, public transit, construction programs and support for local governments.",
    sections: [
      { title: "Transportation programs", body: "Iowa's transportation department administers state and federal grant programs for transportation projects involving local governments and other entities." },
      { title: "Transit systems", body: "Public transportation service is delivered through city and regional transit systems across Iowa, with state and federal transit assistance." },
    ],
  },
  kansas: {
    summary: "Kansas transportation programs cover highways, bridges, aviation, rail, public transit, safety and local infrastructure initiatives.",
    sections: [
      { title: "Infrastructure programs", body: "Kansas transportation programs include bridge improvement, rail service, aviation, active transportation and statewide safety initiatives." },
      { title: "Long-term investment", body: "The Eisenhower Legacy Transportation Program is a 10-year state investment program for transportation infrastructure." },
    ],
  },
  kentucky: {
    summary: "Kentucky transportation work covers highways, aviation, local programs and a statewide network designed to move people and goods.",
    sections: [
      { title: "Engineering disciplines", body: "Kentucky's highway organization includes construction, highway design, structural design, traffic operations, maintenance, planning and professional services." },
      { title: "Local infrastructure", body: "State programs support local governments with transportation alternatives, air-quality, rural and municipal transportation projects." },
    ],
  },
  louisiana: {
    summary: "Louisiana transportation work includes surface transportation, public transit, ports and waterways, freight, rail and aviation.",
    sections: [
      { title: "Project delivery", body: "Louisiana's transportation improvement program schedules highways, bridges, bicycle and pedestrian facilities, safety and congestion-mitigation projects." },
      { title: "Public transportation", body: "State transit programs support rural transportation and mobility services for seniors and people with disabilities." },
    ],
  },
  michigan: {
    summary: "Michigan's transportation network includes nearly 10,000 miles of state highways, regional project delivery and growing mobility programs.",
    sections: [
      { title: "Statewide delivery", body: "Michigan transportation operations use seven regional offices and local service centers for construction and maintenance programs." },
      { title: "Mobility systems", body: "State transportation work includes highway, rail, transit, aeronautics, connected-vehicle and other mobility initiatives." },
    ],
  },
  minnesota: {
    summary: "Minnesota transportation programs span highways, freight, rail, ports, airports, public transit and local transportation projects.",
    sections: [
      { title: "Transportation programs", body: "Minnesota's transportation improvement program schedules and funds state and local transportation projects by fiscal year." },
      { title: "Multimodal systems", body: "State programs include airport development, freight, rail improvement, rural transit, port development and active transportation." },
    ],
  },
  mississippi: {
    summary: "Mississippi transportation planning includes statewide road programs and regional public-transit services that support work, education and community access.",
    sections: [
      { title: "Public transportation", body: "Mississippi public-transit systems provide regional services for employment trips, education, medical appointments and community travel." },
      { title: "Engineering pathways", body: "State transportation education programs introduce students to transportation and civil-engineering problems through practical STEM activities." },
    ],
  },
  missouri: {
    summary: "Missouri transportation work spans highways, bridges, aviation, freight, rail, transit and waterways across a large statewide system.",
    sections: [
      { title: "Engineering disciplines", body: "Missouri transportation engineering includes bridge, design, construction, materials, traffic, planning, maintenance and research work." },
      { title: "Multimodal systems", body: "State programs provide airport funding, rail administration, public-transit assistance, freight development and waterway support." },
    ],
  },
  montana: {
    summary: "Montana transportation work includes statewide planning, highway safety, transit, rail, local-project delivery and resilient infrastructure programs.",
    sections: [
      { title: "Project delivery", body: "Montana transportation programs support design consulting, digital delivery, local project administration, bridge programs and transportation alternatives." },
      { title: "Statewide planning", body: "Montana's statewide transportation planning coordinates projects with state, federal, local and tribal partners." },
    ],
  },
  nebraska: {
    summary: "Nebraska transportation work includes engineering, aviation, planning, maintenance, construction, public transit and local project assistance.",
    sections: [
      { title: "Local infrastructure", body: "Nebraska transportation funding programs support local public agencies with bridge, road, safety and transportation-alternative projects." },
      { title: "Transportation systems", body: "State work includes construction programs, consultant services, safety programs, aeronautics and statewide public-transit options." },
    ],
  },
  nevada: {
    summary: "Nevada transportation work includes freight, rail, aviation, public transit, bicycle and pedestrian programs across the state.",
    sections: [
      { title: "Mobility systems", body: "Nevada transportation programs include fixed-route transit, paratransit, intercity bus, freight, rail and aviation services." },
      { title: "Planning and safety", body: "State programs include transportation reliability, complete streets, traffic-safety engineering, stormwater management and statewide corridor studies." },
    ],
  },
  "new-hampshire": {
    summary: "New Hampshire transportation work includes statewide road, bridge and public-transit programs focused on transportation quality of life.",
    sections: [
      { title: "Public transportation", body: "New Hampshire's transportation department is the state agency responsible for administering federal public-transportation programs." },
      { title: "Project delivery", body: "State transportation programs bring together highway, bridge, transit and local transportation planning work." },
    ],
  },
  "north-dakota": {
    summary: "North Dakota transportation work includes highway, bridge, safety, transit, freight, rail and local funding programs across the state.",
    sections: [
      { title: "Project delivery", body: "State transportation programs cover design, construction, maintenance, operations and snow removal for the highway system." },
      { title: "Statewide planning", body: "The state's transportation improvement program includes highway, bridge, safety, pedestrian and transit projects." },
    ],
  },
  ohio: {
    summary: "Ohio transportation work combines statewide project planning, local delivery programs, construction inspection, traffic and active-transportation initiatives.",
    sections: [
      { title: "Transportation delivery", body: "Ohio's transportation improvement program coordinates managed programs and funding with regional, county, city and transportation-planning partners." },
      { title: "Engineering practice", body: "State training covers access management, bridge scour, construction inspection, CADD, traffic control and roadway-safety subjects." },
    ],
  },
  oklahoma: {
    summary: "Oklahoma transportation work includes highway systems, rail, public transit, waterways, freight and local road programs.",
    sections: [
      { title: "Transportation delivery", body: "Oklahoma's transportation agency plans, designs, constructs, operates and maintains the interstate, U.S. and state highway systems." },
      { title: "Multimodal programs", body: "State programs include freight rail, passenger rail, public transit, inland waterways, active transportation and county road-and-bridge improvements." },
    ],
  },
  oregon: {
    summary: "Oregon transportation work spans highway engineering, rail, public transit, safety, active transportation and local project support.",
    sections: [
      { title: "Engineering disciplines", body: "Oregon highway programs include bridge, construction, environmental, hydraulic, geotechnical and maintenance engineering." },
      { title: "Public transportation", body: "State public-transportation programs provide grants, policy leadership, training and technical assistance to transportation providers." },
    ],
  },
  "rhode-island": {
    summary: "Rhode Island transportation work includes roads, bridges, rail stations, bike paths and ferry service within one statewide surface-transportation system.",
    sections: [
      { title: "Infrastructure delivery", body: "The state transportation department designs, constructs and maintains surface transportation assets, including roads, bridges, rail stations, bike paths and ferry service." },
      { title: "Long-range investment", body: "Rhode Island's transportation improvement program is a 10-year plan of projects submitted by municipalities and monitored through statewide planning." },
    ],
  },
  "south-carolina": {
    summary: "South Carolina transportation work includes state and local road improvements, safety, active transportation and community infrastructure programs.",
    sections: [
      { title: "Local infrastructure", body: "South Carolina's C Program partners with counties to fund projects on state and county roads and city streets." },
      { title: "Active transportation", body: "State programs support pedestrian facilities, bicycle facilities, streetscaping and safer walking and cycling accommodations." },
    ],
  },
  "south-dakota": {
    summary: "South Dakota transportation work includes highways, bridges, rail, airports, public transit and local transportation improvements.",
    sections: [
      { title: "Statewide delivery", body: "The state transportation department constructs, operates and maintains the state highway system while assisting local governments with transportation improvements." },
      { title: "Multimodal programs", body: "State programs administer assistance for rail-line rehabilitation, airport improvements and public transportation, alongside highway investment." },
    ],
  },
  tennessee: {
    summary: "Tennessee transportation work spans roads, aviation, public transit, waterways, railroads, cycling and walking infrastructure.",
    sections: [
      { title: "Engineering delivery", body: "Tennessee's transportation engineering teams plan, design, construct and preserve the state's transportation system while supporting project delivery statewide." },
      { title: "Multimodal investment", body: "The state's comprehensive program includes preliminary engineering, functional design, bridge replacement and rehabilitation, safety, traffic operations and roadway preservation." },
    ],
  },
  utah: {
    summary: "Utah transportation work combines roadway project delivery with transit, aviation and active-transportation planning for a growing statewide network.",
    sections: [
      { title: "Mobility and infrastructure", body: "Utah transportation programs prioritize safe mobility, infrastructure preservation, innovative design and traffic-management strategies." },
      { title: "Transit and aviation", body: "The state's transit division manages fixed-guideway transit projects, while its aeronautics division leads statewide airport, aircraft and air-route planning." },
    ],
  },
  vermont: {
    summary: "Vermont transportation work includes roads, bridges, state-owned railroads, airports, park-and-ride facilities, bicycle and pedestrian paths, and public transit.",
    sections: [
      { title: "Highway project delivery", body: "Vermont's highway organization provides investment planning, engineering design, construction oversight, materials quality, municipal technical support and bridge and culvert maintenance." },
      { title: "Intermodal systems", body: "The state's intermodal organization oversees state-owned rail lines, airports, public transit providers and state-owned rail trails." },
    ],
  },
  maryland: {
    summary:
      "Maryland's transportation network includes highway structures, airport runways, harbor and port facilities within a multimodal system.",
    sections: [
      {
        title: "Infrastructure work",
        body: "Maryland transportation engineering work spans planning, design, construction and maintenance across the state's transportation network.",
      },
      {
        title: "Multimodal delivery",
        body: "The state transportation department includes highway, aviation, port and transit operations within its statewide delivery structure.",
      },
    ],
  },
  "new-mexico": {
    summary:
      "Water management and the state's federal presence shape much of New Mexico's engineering work.",
    sections: [
      {
        title: "Water and drainage",
        body: "Water supply, reuse, aquifer recharge, conservation, arroyos and flood-control design are central parts of the state's infrastructure work.",
      },
      {
        title: "Professional engineering licensure",
        body: "New Mexico licenses engineers through a statewide board; water-related work can also involve the Office of the State Engineer.",
      },
    ],
  },
  "new-york": {
    summary:
      "New York combines dense metropolitan infrastructure programs downstate with state, county and municipal work across the rest of the state.",
    sections: [
      {
        title: "Infrastructure work",
        body: "Downstate work includes transit and rail capital programs, water and sewer systems, bridges, tunnels and complex urban construction.",
      },
      {
        title: "Professional engineering licensure",
        body: "A New York PE license is commonly required for client-facing design; certain New York City filings and inspections can require additional registration.",
      },
    ],
  },
  washington: {
    summary:
      "Washington manages a multimodal transportation system focused on moving people and goods safely and efficiently across the state.",
    sections: [
      {
        title: "Transportation programs",
        body: "Washington's transportation organization includes regional operations, urban mobility programs, rail, freight, ports, public transportation, aviation and active transportation.",
      },
      {
        title: "Engineering delivery",
        body: "Engineering support covers design documentation, constructability review and regional engineering assistance for transportation project delivery.",
      },
    ],
  },
  virginia: {
    summary: "Virginia transportation work includes the building, maintenance and operation of roads, bridges and tunnels, together with investment in airports, seaports, rail and public transportation.",
    sections: [
      { title: "Statewide infrastructure", body: "Virginia maintains one of the country's largest state-maintained highway systems, delivered through nine highway districts that oversee local construction and maintenance." },
      { title: "Structures engineering", body: "The state's bridge organization plans, designs, inspects, maintains and rehabilitates bridges while providing engineering standards, quality assurance and specialist support." },
    ],
  },
  "west-virginia": {
    summary: "West Virginia transportation work combines highway construction and maintenance with public transit, rail, airports, river ports and other multimodal facilities.",
    sections: [
      { title: "Highway infrastructure", body: "West Virginia's highway organization manages statewide highway policies, projects, bridge information, engineering services and transportation planning across a mountain transportation system." },
      { title: "Multimodal connections", body: "The state supports aeronautics, intermodal ports, public-transit programs and essential rail service through an integrated transportation-facilities organization." },
    ],
  },
  wisconsin: {
    summary: "Wisconsin transportation work includes highways, bridges, transit, rail, aviation, ports and harbors, and bicycle and pedestrian systems.",
    sections: [
      { title: "Highways and structures", body: "Wisconsin's transportation department plans, builds and maintains the state highway system and manages inspection information for bridges across the state and local road networks." },
      { title: "Multimodal planning", body: "The state's long-range transportation plan covers roads, transit, walking, bicycling, rail, aviation and water transportation, with support for the full statewide network." },
    ],
  },
  wyoming: {
    summary: "Wyoming transportation work serves a large multimodal system of roads, bridges, air travel, transit, pathways and freight rail.",
    sections: [
      { title: "Engineering and infrastructure", body: "Engineers and technicians at Wyoming's transportation department develop plans and specifications for highway, bridge and related infrastructure improvement projects." },
      { title: "Statewide coordination", body: "The state supports airport improvement, public transit and local planning alongside its highway system, with transit programs administered through the transportation department." },
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
