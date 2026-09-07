import { processCase } from "./lib/domain/engine";
import { DEMO_CASES, generateExtraCases, USERS } from "./lib/domain/seed";
import { POLICY_DB, computeRedress, searchPolicy, refreshPolicyVersions } from "./lib/domain/policy";
import { policyVersionFor } from "./lib/domain/agents";
import { PRODUCTS, CHANNELS } from "./lib/domain/catalog";
import { summarise, byField, agentStats, isBreached } from "./lib/domain/metrics";
import {
  getStaff, setStaff, getBranches, getProducts, setProducts, getThresholds, setThresholds,
  applyPolicyOverrides, setRuleParam, setDocApproved, defaultStaff, defaultProducts, ROLE_LABEL,
} from "./lib/domain/admin";
import { AGENT_LABEL, agentForChannel } from "./lib/domain/engine";

(globalThis as unknown as { CCN: unknown }).CCN = {
  processCase, DEMO_CASES, generateExtraCases, USERS,
  POLICY_DB, computeRedress, searchPolicy, refreshPolicyVersions, policyVersionFor,
  PRODUCTS, CHANNELS, summarise, byField, agentStats, isBreached,
  getStaff, setStaff, getBranches, getProducts, setProducts, getThresholds, setThresholds,
  applyPolicyOverrides, setRuleParam, setDocApproved, defaultStaff, defaultProducts, ROLE_LABEL,
  AGENT_LABEL, agentForChannel,
};
