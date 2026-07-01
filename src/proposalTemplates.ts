import { ProposalIntake } from "./proposalTypes.js";

function makeList(items: string[] | undefined): string {
  if (!items || items.length === 0) return "- TBD";
  return items.map(item => `- ${item}`).join("\n");
}

export function coverPageTemplate(intake: ProposalIntake, version: number, readiness: "DRAFT" | "FINAL"): string {
  return `# BUSINESS PROPOSAL & TECHNICAL RESPONSE

**PROJECT NAME:** ${intake.projectName}  
**CLIENT ORGANIZATION:** ${intake.organization || "Not specified"}  
**GEOGRAPHY:** ${intake.country || "Not specified"}  
**INDUSTRY VERTICAL:** ${intake.industry || "Not specified"}  
**FUNDING MECHANISM:** ${intake.fundingType || "Not specified"}  

**DOCUMENT CONTROL ID:** PROP-${intake.projectName.toUpperCase().replace(/[^A-Z0-9]/g, "")}-${new Date().getFullYear()}-V${version}  
**VERSION:** ${version.toFixed(1)}  
**DATE:** ${new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}  
**STATUS:** ${readiness}${readiness === "DRAFT" ? " — contains unconfirmed assumptions (see Appendix Z)" : " — QA verified, no blocking assumptions"}  
**CONFIDENTIALITY:** STRICTLY CONFIDENTIAL  

---
*Prepared by Shiptec AI Proposal Factory. Assumptions are tracked, not hidden — see Appendix Z. All rights reserved.*
`;
}

export function executiveSummaryTemplate(intake: ProposalIntake): string {
  return `# 1. Executive Summary

## 1.1 Product Vision
${intake.productSummary}

## 1.2 Vision Statement
${intake.vision || "To establish a governed, highly efficient system that solves core operational problems through state-of-the-art technological architectures."}

## 1.3 Mission Statement
${intake.mission || "To deploy scalable, secure, and compliance-aligned software products that empower users and provide measurable ROI to stakeholders."}

## 1.4 Strategic Objectives
The strategic goals of this project are:
${makeList(intake.strategicObjectives || [
  `Improve operational efficiency in the target domain.`,
  `Reduce downtime and process bottlenecks.`,
  `Ensure 100% compliance with relevant local and international industry standards.`
])}
`;
}

export function tableOfContentsTemplate(): string {
  return `# Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Background & Problem Statement](#2-background--problem-statement)
- [3. Needs Assessment & Gap Analysis](#3-needs-assessment--gap-analysis)
- [4. Project Justification & Alignment](#4-project-justification--alignment)
- [5. SMART Objectives & Scope](#5-smart-objectives--scope)
- [6. Technical Solution & Architecture](#6-technical-solution--architecture)
- [7. Implementation & Work Plan](#7-implementation--work-plan)
- [8. Governance & Organizational Capacity](#8-governance--organizational-capacity)
- [9. Financial Proposal & Cost-Benefit Analysis](#9-financial-proposal--cost-benefit-analysis)
- [10. Risk Management & Quality Assurance](#10-risk-management--quality-assurance)
- [11. Monitoring, Evaluation & Sustainability](#11-monitoring-evaluation--sustainability)
- [12. Environmental, Social & Legal Compliance](#12-environmental-social--legal-compliance)
- [13. Expected Outcomes & Return on Investment](#13-expected-outcomes--return-on-investment)
- [14. Conclusion & Appendices](#14-conclusion--appendices)
`;
}

export function backgroundTemplate(intake: ProposalIntake): string {
  return `# 2. Background & Problem Statement

## 2.1 Background
The project **${intake.projectName}** operates within the **${intake.industry || "General"}** industry in **${intake.country || "Global"}**. The modern operational landscape requires high degrees of process automation, reliability, and security, creating a strong impetus for modernization.

## 2.2 Current Operational Landscape
The client's current operations rely on the following model:
> *${intake.currentWorkflow}*
`;
}

export function problemStatementTemplate(intake: ProposalIntake): string {
  return `## 2.3 Problem Statement
The organization currently faces a critical challenge:
> *${intake.businessProblem}*

This operational bottleneck leads to inefficiencies, increased risks, and a failure to capture key opportunities.
`;
}

export function needsAssessmentTemplate(intake: ProposalIntake): string {
  return `# 3. Needs Assessment & Gap Analysis

## 3.1 Needs Assessment
To transition from the current state to the desired state, the organization requires:
- A modernized system to automate repetitive, error-prone workflows.
- Integration of robust security standards to protect data transit and storage.
- Real-time reporting and analytics capabilities.

## 3.2 Desired Workflow State
The future state of the project will achieve:
> *${intake.desiredWorkflow}*
`;
}

export function opportunityAnalysisTemplate(intake: ProposalIntake): string {
  return `## 3.3 Opportunity Analysis
By resolving the current workflow issues, the project creates a unique market opportunity:
- **Market Size / Impact Area:** ${intake.marketSize || "Significant enterprise scale with multi-departmental application."}
- **Target Opportunity:** ${intake.opportunityStatement || "Automation of core workflows to unlock human capital for strategic growth."}
- **Value Proposition:** ${intake.valueProposition || "A highly secure, highly governed project delivery system that eliminates compliance risks."}
`;
}

export function projectJustificationTemplate(intake: ProposalIntake): string {
  return `# 4. Project Justification & Alignment

## 4.1 Project Justification
The decision to implement **${intake.projectName}** is justified by the strategic need to replace outdated, manual processes with integrated, scalable software. Doing nothing poses high reputational, operational, and financial risks due to the bottlenecks in:
> *${intake.businessProblem}*

## 4.2 Competitive Advantage
Compared to alternatives and competitors (${(intake.competitors || ["Manual methods", "In-house custom builds"]).join(", ")}):
- **Core Edge:** ${intake.competitiveAdvantage || "Out-of-the-box security compliance, rapid provisioning, and governed sprint cycle implementation."}
`;
}

export function strategicAlignmentTemplate(intake: ProposalIntake): string {
  return `## 4.3 Strategic Alignment
This initiative directly aligns with the strategic vision of ${intake.organization || "the client organization"}:
- **Vision Alignment:** ${intake.vision || "Modern digital transformation."}
- **Mission Alignment:** ${intake.mission || "Delivering reliable, scalable value."}
`;
}

export function smartObjectivesTemplate(intake: ProposalIntake): string {
  return `# 5. SMART Objectives & Scope

## 5.1 SMART Objectives
To guarantee project success, we define the following Specific, Measurable, Achievable, Relevant, and Time-bound objectives:
${makeList(intake.successCriteria.map((c, i) => `**Objective ${i + 1}:** Achieve ${c} within the defined timeline.`))}
`;
}

export function scopeTemplate(intake: ProposalIntake): string {
  return `## 5.2 Scope (MVP Definition)
The project scope is strictly bounded to the MVP definition to prevent scope creep:
> *${intake.mvpDefinition}*

### 5.3 Out of Scope
The following components are explicitly declared out of scope for the current phase:
- Support for legacy platforms outside the default tech stack.
- Multi-region geo-replication (deferred to future expansion phases).
- Custom integrations with third-party tools not explicitly listed.
`;
}

export function solutionOverviewTemplate(intake: ProposalIntake): string {
  return `# 6. Technical Solution & Architecture

## 6.1 Solution Overview
The technical solution is designed to support the target users:
- **Target Users:** ${(intake.targetUsers || []).join(", ") || "End users and system administrators"}

It addresses the core workflow requirements through a highly structured, scalable software architecture.
`;
}

export function technicalArchitectureTemplate(intake: ProposalIntake): string {
  return `## 6.2 Technical Architecture
The system employs the following architectural blueprint:
- **Default Stack:** ${(intake.technologyStack || ["Node.js", "TypeScript", "Express", "Markdown artifacts"]).join(", ")}
- **Architecture Style:** Model-View-Controller API pattern with persistent artifact stores.
- **Scalability Model:** ${intake.scalabilityPlan || "Horizontal scaling of stateless API nodes combined with secure cloud database clustering."}
`;
}

export function requirementsTemplate(intake: ProposalIntake): string {
  return `## 6.3 Functional & Non-functional Requirements

### Functional Requirements
${makeList(intake.functionalRequirements || [
  "Structured intake capture panel",
  "Automated validation gate scoring",
  "Markdown-based artifact generator",
  "Submodule code management integrations"
])}

### Non-functional Requirements
${makeList(intake.nonFunctionalRequirements || [
  "Performance: Page loading and API response under 500ms",
  "Security: Token-based API authentication and HTTPS transit encryption",
  "Maintainability: 100% typed code interfaces in TypeScript"
])}
`;
}

export function implementationMethodologyTemplate(): string {
  return `# 7. Implementation & Work Plan

## 7.1 Implementation Methodology
We utilize the **Shiptec Architect-Builder Split Methodology**. This strictly enforces separation of concerns:
1. **Architect Phase:** Intakes requirements, models configurations, and generates blueprint gates.
2. **Builder Phase:** Translates blueprints into software commits, with strict boundary constraints and zero-hallucination execution.
`;
}

export function workBreakdownStructureTemplate(intake: ProposalIntake): string {
  const phases = intake.phases || [
    { name: "Phase 1: Foundation", description: "Tech stack provisioning & repository setup", duration: "2 weeks", deliverables: ["Configured git repository", "Base API server setup"] },
    { name: "Phase 2: Core Engine", description: "Implementation of key domain services", duration: "4 weeks", deliverables: ["Service layer code", "Integration test suite"] },
    { name: "Phase 3: Integration & QA", description: "Frontend cockpit implementation & final review", duration: "2 weeks", deliverables: ["Admin dashboard", "QA sign-off report"] }
  ];

  let wbs = `## 7.2 Work Breakdown Structure\n\n`;
  phases.forEach((p, idx) => {
    wbs += `### 7.2.${idx + 1} ${p.name} (${p.duration})\n`;
    wbs += `${p.description}\n`;
    wbs += `**Key Deliverables:**\n`;
    wbs += p.deliverables.map(d => `  - ${d}`).join("\n") + "\n\n";
  });

  return wbs;
}

export function timelineMilestonesTemplate(intake: ProposalIntake): string {
  const milestones = intake.milestones || [
    { name: "M1: Kickoff & Setup", date: "Week 2", deliverable: "Project repository", criteria: "Build compiles with zero warnings" },
    { name: "M2: Core Features Complete", date: "Week 6", deliverable: "API routes", criteria: "All unit and integration tests passing" },
    { name: "M3: Production Handoff", date: "Week 8", deliverable: "Deployable package", criteria: "QA review score of 9/10 achieved" }
  ];

  let table = `## 7.3 Timeline & Milestones\n\n`;
  table += `| Milestone | Targeted Timeline | Key Deliverable | Success Criteria |\n`;
  table += `|---|---|---|---|\n`;
  milestones.forEach(m => {
    table += `| ${m.name} | ${m.date} | ${m.deliverable} | ${m.criteria} |\n`;
  });
  return table + "\n";
}

export function governanceStructureTemplate(intake: ProposalIntake): string {
  return `# 8. Governance & Organizational Capacity

## 8.1 Governance & Team Structure
The project governance model ensures clear responsibilities and communication:
- **Decision Making Model:** ${intake.decisionMaking || "Consensus-driven design approved by Project Director; implemented by Builder."}
- **Communication Matrix:** ${intake.communicationPlan || "Weekly status reports synced via Planning/Governance/Current_State.md."}

## 8.2 Roles and Staffing Matrix
${makeList(intake.teamStructure || [
  "Proposal Director — Overall program alignment and commercial sign-off.",
  "Enterprise Architect — Technical design and blueprint gatekeeper.",
  "Lead Developer — Builder coordinator and implementation owner.",
  "QA Specialist — Independent validation and scoring auditor."
])}
`;
}

export function stakeholderEngagementTemplate(intake: ProposalIntake): string {
  return `## 8.3 Stakeholder Engagement Strategy
To ensure alignment across all levels of the organization:
- **Primary Stakeholders:** ${(intake.primaryStakeholders || ["System owners", "Product managers"]).join(", ")}
- **Secondary Stakeholders:** ${(intake.secondaryStakeholders || ["Operations team", "Compliance team"]).join(", ")}
- **Project Sponsors:** ${(intake.sponsors || ["Executive leadership", "Funding directors"]).join(", ")}
- **Strategic Partners:** ${(intake.partners || ["Technology vendors", "Independent auditors"]).join(", ")}
`;
}

export function staffingCapacityTemplate(): string {
  return `## 8.4 Organizational Capacity Statement
Our team holds deep technical expertise in constructing robust, governed software pipelines. Leveraging the Shiptec Command Center guarantees zero-hallucination delivery cycles, maximizing client confidence by maintaining a strict, auditable implementation log from initiation to handoff.
`;
}

export function budgetNarrativeTemplate(intake: ProposalIntake): string {
  return `# 9. Financial Proposal & Cost-Benefit Analysis

## 9.1 Budget Narrative
The total estimated budget for **${intake.projectName}** is **${intake.budgetTotal || intake.budget || "TBD"}**. This covers all phases of development, licensing, infrastructure setup, compliance auditing, and training.
`;
}

export function detailedBudgetTemplate(intake: ProposalIntake): string {
  const lineItems = intake.budgetLineItems || [];

  let table = `## 9.2 Detailed Budget Breakdown\n\n`;
  if (lineItems.length === 0) {
    // HONESTY: do not fabricate a budget. The Confidence Gate blocks FINAL
    // promotion until the client supplies real figures.
    table += `> ⚠️ **No budget line items were provided.** This table is intentionally empty. `;
    table += `Figures must be confirmed by the client before this proposal can be promoted to FINAL.\n\n`;
    return table;
  }

  let total = 0;
  table += `| Category | Item | Quantity | Unit Cost | Total Cost | Deliverable Mapping |\n`;
  table += `|---|---|---|---|---|---|\n`;
  lineItems.forEach(item => {
    const cost = item.totalCost || (item.quantity * item.unitCost);
    total += cost;
    table += `| ${item.category} | ${item.item} | ${item.quantity} | $${item.unitCost.toLocaleString()} | $${cost.toLocaleString()} | ${item.deliverable} |\n`;
  });
  table += `| **GRAND TOTAL** | | | | **$${total.toLocaleString()}** | |\n`;

  return table + "\n";
}

export function costBenefitAnalysisTemplate(intake: ProposalIntake): string {
  return `## 9.3 Cost-Benefit Analysis
The primary benefits of this automation project include:
- **Operational Savings:** Reduction in manual labor by automating high-frequency tasks.
- **Risk Mitigation:** Elimination of compliance failures and software security leaks.
- **Speed to Market:** Shiptec-driven rapid release cycles.
`;
}

export function procurementPlanTemplate(intake: ProposalIntake): string {
  return `## 9.4 Procurement Plan
The project will procure the following key tools and integrations:
${makeList(intake.toolsAndIntegrations || ["Cloud hosting instance", "Version control licensing", "Continuous Integration pipelines"])}
`;
}

export function riskRegisterTemplate(intake: ProposalIntake): string {
  const risks = intake.knownRisks || [];

  let table = `# 10. Risk Management & Quality Assurance\n\n`;
  table += `## 10.1 Risk Register & Mitigation Matrix\n\n`;
  if (risks.length === 0) {
    // HONESTY: do not fabricate a risk register. The Confidence Gate blocks
    // FINAL promotion until the client supplies real risks.
    table += `> ⚠️ **No risks were provided.** This register is intentionally empty. `;
    table += `Risks must be supplied by the client before this proposal can be promoted to FINAL.\n\n`;
    return table;
  }

  table += `| Risk ID | Description | Category | Likelihood | Impact | Severity (1-9) | Mitigation Strategy | Owner |\n`;
  table += `|---|---|---|---|---|---|---|---|\n`;
  risks.forEach(r => {
    table += `| ${r.id} | ${r.description} | ${r.category} | ${r.likelihood} | ${r.impact} | ${r.severity} | ${r.mitigation} | ${r.owner} |\n`;
  });

  return table + "\n";
}

export function qualityAssuranceTemplate(): string {
  return `## 10.2 Quality Assurance Plan
Our quality assurance program is built directly into the Shiptec engine:
- **Automated Validation Gates:** All project folders are scanned for completeness before execution.
- **Dry Run Verification:** Builders must execute a mock plan and assert expected changes.
- **Self-Critique Scoring Loop:** Proposal structures are scored across 13 distinct dimensions to guarantee evaluator-winning clarity.
`;
}

export function monitoringEvaluationTemplate(intake: ProposalIntake): string {
  const kpis = intake.kpis || [];

  let table = `# 11. Monitoring, Evaluation & Sustainability\n\n`;
  table += `## 11.1 Monitoring & Evaluation Framework\n\n`;
  if (kpis.length === 0) {
    // HONESTY: do not fabricate KPIs. The Confidence Gate blocks FINAL
    // promotion until success criteria (and thus KPIs) are supplied.
    table += `> ⚠️ **No KPIs were provided.** This framework is intentionally empty. `;
    table += `Success criteria must be supplied by the client before this proposal can be promoted to FINAL.\n\n`;
    return table;
  }

  table += `| KPI | Description | Baseline | Target | Reporting Frequency | Data Source | Owner |\n`;
  table += `|---|---|---|---|---|---|---|\n`;
  kpis.forEach(k => {
    table += `| ${k.name} | ${k.description} | ${k.baseline} | ${k.target} | ${k.frequency} | ${k.dataSource} | ${k.responsible} |\n`;
  });

  return table + "\n";
}

export function sustainabilityPlanTemplate(intake: ProposalIntake): string {
  return `## 11.2 Sustainability Plan
To ensure long-term viability of the project after handover:
- **Maintenance Model:** ${intake.sustainabilityPlan || "Standard maintenance SLAs with post-launch technical support sprints."}
- **Knowledge Transfer:** Comprehensive documentation including Methodology Guides and Technical Blueprints.
`;
}

export function scalabilityRoadmapTemplate(intake: ProposalIntake): string {
  return `## 11.3 Scalability Roadmap
The architecture is primed for expansion:
- **Horizontal Scaling:** Deployment in dockerized container clusters.
- **Feature Growth:** ${intake.expansionStrategy || "Integration of secondary analytics widgets and customized customer portal access."}
`;
}

export function communicationPlanTemplate(intake: ProposalIntake): string {
  return `# 12. Environmental, Social & Legal Compliance

## 12.1 Communication Plan
All communication will run through scheduled syncs:
- **Format:** Current state audits posted to the governance directory.
- **Stakeholder Sync:** ${intake.communicationPlan || "Bi-weekly project manager briefings."}
`;
}

export function changeManagementTemplate(): string {
  return `## 12.2 Change Management Plan
Any modifications to the technical blueprint or scope must be formally filed in the decisions log:
- **Process:** Change request filed $\rightarrow$ Impact analysis performed $\rightarrow$ Architect approval recorded in Decisions.md.
`;
}

export function trainingPlanTemplate(): string {
  return `## 12.3 Training Plan
Prior to final handover, the team will receive structured training:
- **Developer Training:** Command Center API structure and Git submodule update flows.
- **Operator Training:** Intake configuration and sprint dry run execution.
`;
}

export function operationsMaintenanceTemplate(): string {
  return `## 12.4 Operations & Maintenance Guide
The runtime environment requires minimal operational overhead:
- **Logs:** Express error logs are directed to stdout/stderr.
- **Monitoring:** Periodic health checks verify filesystem availability and Git connectivity.
`;
}

export function environmentalSocialImpactTemplate(intake: ProposalIntake): string {
  return `## 12.5 Environmental, Social & Governance (ESG) Impact
- **Inclusion Strategy:** ${intake.inclusionStrategy || "Adherence to WCAG 2.1 accessibility guidelines across all user interfaces."}
- **Environmental Sustainability:** ${intake.environmentalSustainability || "Leverage of green cloud hosting zones to reduce carbon footprint."}
- **ESG Statement:** ${intake.esgStatement || "Commitment to ethical vendor sourcing and open-source documentation standards."}
`;
}

export function legalComplianceTemplate(intake: ProposalIntake): string {
  return `## 12.6 Legal & Regulatory Compliance
We ensure full compliance with target regulations:
- **Privacy Standards:** ${intake.privacyRequirements?.join(", ") || "GDPR/CCPA alignment through tenant data isolation."}
- **Regulatory Frameworks:** ${intake.regulatoryRequirements?.join(", ") || "Strict data integrity validation on all inputs."}
`;
}

export function expectedOutcomesTemplate(intake: ProposalIntake): string {
  return `# 13. Expected Outcomes & Return on Investment

## 13.1 Expected Outcomes
By executing **${intake.projectName}**, the client will realize:
- Streamlined project initialization and governed delivery.
- Higher release quality with zero-hallucination builder logs.
- Absolute confidence in commercial procurement workflows.
`;
}

export function successMetricsTemplate(intake: ProposalIntake): string {
  return `## 13.2 Success Metrics
The metrics for evaluating final delivery are:
${makeList(intake.successCriteria.map(s => `${s} (Validated at handover)`))}
`;
}

export function roiTemplate(intake: ProposalIntake): string {
  return `## 13.3 Return on Investment (ROI) Projection
- **Direct ROI:** ${intake.roiProjection || "Estimated 35% reduction in project engineering cost overhead within the first 12 months."}
- **Payback Period:** Typically achieved within 6 months post-delivery of the MVP.
`;
}

export function conclusionTemplate(projectName?: string): string {
  return `# 14. Conclusion & Appendices

## 14.1 Conclusion
The **${projectName || "Shiptec AI Proposal Factory"}** represents a rigorous, evidence-based roadmap designed to win evaluator confidence. By aligning detailed technical requirements with robust financial accountability and automated QA checks, we guarantee a successful implementation cycle.
`;
}

export function appendicesTemplate(intake: ProposalIntake): string {
  return `## 14.2 Appendices
- **Appendix A:** Technical Blueprint Reference (Planning/Technical_Blueprint.md)
- **Appendix B:** Client Intake Form Configuration (Intake Parameters)
- **Appendix C:** External Reference Knowledge Bases (${(intake.knowledgeUrl || []).join(", ") || "None provided"})
`;
}
