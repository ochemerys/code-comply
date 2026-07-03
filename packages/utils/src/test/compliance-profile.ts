/**
 * M11 artifact-existence tests run only when CODECOMPLY_COMPLIANCE_PROFILE=internal.
 * Public mirror CI uses test:unit (default profile); private CI uses test:compliance.
 */
export const runComplianceTests = process.env.CODECOMPLY_COMPLIANCE_PROFILE === 'internal'
