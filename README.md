# Metro Crisis

**A 3D subway crisis simulator exploring how AI assistance affects human decisions.**

**Track 3:** Apply AI to power grids, transportation, and critical public systems.

During a flood, protecting passengers can mean closing stations and disrupting journeys. Metro Crisis lets operators explore these tradeoffs through a simplified New York City subway network, then compare human-operated responses with and without decision support.

## Run the project

Download the HTML files and open them in a desktop browser such as Chrome or Safari. If viewing a file on GitHub, download the raw file first.

| File | Purpose |
|---|---|
| [main-sim.html](main-sim.html) | Interactive 3D simulator with human-alone and assisted rounds |
| [replay.html](replay.html) | Recorded 3D playback and comparison findings |
| [2d-exper.html](2d-exper.html) | Earlier 2D experimental prototype |

The main simulator and replay require **no API key, backend, or package installation**. Use `replay.html` for a short demonstration and `main-sim.html` to try operating the network yourself.

## How to use the simulator

1. Select Scenario A, B, or C, an assumption set, and a condition order.
2. Begin the round and monitor water readings, passenger occupancy, resources, and incidents.
3. Select stations or trains to act. Use the Status, Repairs, Trains, and Crews tabs for network controls.
4. In the assisted condition, accept or dismiss MetroMind's recommendations.
5. Complete the second matched round, review the comparison, and export your data.

Each round represents **60 simulated minutes at 20× speed**, taking about **three active minutes**. Pauses stop the simulation and are recorded.

| Scenario | Focus |
|---|---|
| A | Rainfall and flood response |
| B | Heavier rainfall and passenger demand |
| C | Flood response with a stale water sensor |

## Simulation and assistance

Stations have different assumed sizes, drainage capacities, and rainfall catchments. Water is tracked by volume, so pumping affects each station differently. Three pumps, two technical crews, two response teams, and compatible spare trains must be allocated across the network. Resources require travel and setup time; repairs, evacuation, and reopening have operational restrictions.

**Station percentages show passenger occupancy, not flood probability.** Track and floor readings show observed water depth. A completed journey means a passenger reached their assigned destination.

The demonstrated MetroMind adviser uses **programmed rules**, not an LLM or trained model. It prioritizes interventions using the same sensor observations available to the operator, including potentially stale readings. It has no access to the hidden future incident schedule.

Recommendations stay pinned until accepted or dismissed. Acceptance attempts an intervention; current restrictions can still block execution. Shown, accepted, dismissed, and executed advice are tracked separately. The human controls decisions in both conditions.

## Replay and recorded findings

The replay provides Human, AI Assistance, and synchronized Compare views, with playback speed controls, a timeline, recorded decisions, comparison tables, and downloadable data.

The presentation dataset contains **three matched pairs—six rounds—from one participant**, covering Scenarios A, B, and C under baseline assumptions.

| Outcome across the three pairs | Human alone | With assistance |
|---|---:|---:|
| Completed journeys | 4,450 | 4,040 |
| Estimated mobilization spending | $103,000 | $97,500 |

Assisted rounds recorded **81.6% lower pooled modeled hazard exposure**, alongside **410 fewer completed journeys** and **$5,500 less estimated spending**. The findings show a safety-versus-service tradeoff rather than improvement on every measure.

Hazard exposure measures modeled passenger time in hazardous conditions. It is not a count of injuries. Reconstructed final replay metrics were checked against the original exports.

## Experimental LLM versions

Separate OpenAI and Gemini integrations let an LLM choose an intervention from an unranked action menu, subject to human approval and execution checks. They require a local Node.js backend and private API key; follow their own setup instructions and never upload `.env`.

Gemini quota/rate-limit errors prevented reliable live evaluation. **The recorded findings measure the rule-based adviser, not an LLM.**

## Built with

- JavaScript, HTML, and CSS
- Three.js for the 3D visualization
- Node.js and provider APIs for the separate LLM experiments
- GitHub for collaboration and distribution

AI coding tools assisted development and debugging. Verification included interface behavior, water and passenger accounting, and recorded replay consistency.

## Scope and next steps

Metro Crisis is an educational simulation, **not a validated MTA planning tool**. Station geometry, capacities, equipment performance, costs, and task durations are disclosed assumptions. 

The small, single-participant dataset and repeated scenarios do not establish a general causal benefit of AI assistance. Future work includes expert review of assumptions, more participants with balanced condition order, additional crises, and direct evaluation of the LLM adviser against the rule-based system.
