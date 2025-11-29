// Rule Engine implementation
// This will be implemented in subsequent tasks

import { Rule } from '@/types';

export class RuleEngine {
  convertToDeclarativeRules(_rules: Rule[]): chrome.declarativeNetRequest.Rule[] {
    // To be implemented
    throw new Error('Not implemented');
  }

  evaluateRule(_rule: Rule, _request: any): boolean {
    // To be implemented
    throw new Error('Not implemented');
  }

  applyRule(_rule: Rule, _request: any): any {
    // To be implemented
    throw new Error('Not implemented');
  }

  resolvePriorities(_matchingRules: Rule[]): Rule[] {
    // To be implemented
    throw new Error('Not implemented');
  }
}
