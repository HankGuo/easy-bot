import { EnterpriseRole, SecurityContext } from '../core/auth/security-context.js';
import { Expert, Channel } from '../core/im-engine.js';
import { WorkflowTemplate } from '../core/workflow-engine.js';
import { MCPToolDefinition, MCPToolHandler } from '../core/mcp-host.js';

export interface DomainToolRegistration {
  definition: MCPToolDefinition;
  handler: MCPToolHandler;
}

export interface DomainPack {
  id: string;
  name: string;
  description: string;
  version: string;
  roleAliases?: Record<string, EnterpriseRole>;
  identityMapping?: (rawAttrs: Record<string, any>) => Partial<SecurityContext>;
  specialists?: Expert[];
  channels?: Channel[];
  workflows?: WorkflowTemplate[];
  customTools?: DomainToolRegistration[];
  keywordRouting?: Record<string, string>; // keyword substring -> expertId
  onLoad?: (context: {
    mcp: any;
    im: any;
    workflow: any;
    rag: any;
  }) => Promise<void> | void;
}
