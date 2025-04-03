/**
 * bayesian network is a probabilistic graphical model that represents a set of variables and their conditional dependencies via a directed acyclic graph (DAG).
 * we can use bayesian network to generate consistent samples from a network(select a random value from a distribution).
 * This code is based on https://github.com/apify/fingerprint-suite/tree/master/packages/generative-bayesian-network
 * Reasons for extracting this code is performance.
 * 1. It was taking ~3ms to generate a sample.
 * 2. The package expects network to be in zip format and decompression is expensive.
 *
 * This simple code takes ~0.0x ms to generate a sample.
 */

type NodeDefinition = {
  name: string;
  parentNames: string[];
  possibleValues: string[];
  conditionalProbabilities: any;
};

type BayesianNetworkDefinition = {
  nodes: NodeDefinition[];
};

/**
 * Generates a consistent sample from a Bayesian network given value possibilities
 * @param networkDefinition The Bayesian network definition
 * @param valuePossibilities Possible values for each node (optional)
 * @returns A consistent sample or empty object if no consistent sample is possible
 */
export function generateConsistentSample(
  networkDefinition: BayesianNetworkDefinition,
  valuePossibilities: Record<string, string[]> = {}
): Record<string, string> {
  return recursivelyGenerateConsistentSample(networkDefinition.nodes, {}, valuePossibilities, 0);
}

/**
 * Samples a value from conditional probabilities given parent values
 * @param nodeDefinition Current node definition
 * @param parentValues Values of parent nodes
 */
function getProbabilitiesGivenKnownValues(
  nodeDefinition: NodeDefinition,
  parentValues: Record<string, string> = {}
) {
  let probabilities = nodeDefinition.conditionalProbabilities;

  for (const parentName of nodeDefinition.parentNames) {
    const parentValue = parentValues[parentName];
    if (parentValue in probabilities.deeper) {
      probabilities = probabilities.deeper[parentValue];
    } else {
      probabilities = probabilities.skip;
    }
  }
  return probabilities;
}

/**
 * Samples a random value based on given probabilities
 */
function sampleRandomValueFromProbabilities(
  possibleValues: string[],
  totalProbability: number,
  probabilities: Record<string, number>
) {
  let chosenValue = possibleValues[0];
  const anchor = Math.random() * totalProbability;
  let cumulativeProbability = 0;

  for (const possibleValue of possibleValues) {
    cumulativeProbability += probabilities[possibleValue];
    if (cumulativeProbability > anchor) {
      chosenValue = possibleValue;
      break;
    }
  }

  return chosenValue;
}

/**
 * Samples a value for a node according to given restrictions
 */
function sampleNodeWithRestrictions(
  nodeDefinition: NodeDefinition,
  parentValues: Record<string, string>,
  valuePossibilities?: string[],
  bannedValues: string[] = []
): string | false {
  const probabilities = getProbabilitiesGivenKnownValues(nodeDefinition, parentValues);
  let totalProbability = 0.0;
  const validValues = [];
  const valuesInDistribution = Object.keys(probabilities);
  const possibleValues = valuePossibilities || valuesInDistribution;

  for (const value of possibleValues) {
    if (!bannedValues.includes(value) && valuesInDistribution.includes(value)) {
      validValues.push(value);
      totalProbability += probabilities[value];
    }
  }

  if (validValues.length === 0) return false;
  return sampleRandomValueFromProbabilities(validValues, totalProbability, probabilities);
}

/**
 * Recursively generates a consistent sample from the network
 */
function recursivelyGenerateConsistentSample(
  nodes: NodeDefinition[],
  sampleSoFar: Record<string, string>,
  valuePossibilities: Record<string, string[]>,
  depth: number
): Record<string, string> {
  const bannedValues: string[] = [];
  const node = nodes[depth];
  let sampleValue;

  do {
    sampleValue = sampleNodeWithRestrictions(
      node,
      sampleSoFar,
      valuePossibilities[node.name],
      bannedValues
    );

    if (!sampleValue) break;

    sampleSoFar[node.name] = sampleValue;

    if (depth + 1 < nodes.length) {
      const sample = recursivelyGenerateConsistentSample(
        nodes,
        sampleSoFar,
        valuePossibilities,
        depth + 1
      );
      if (Object.keys(sample).length !== 0) {
        return sample;
      }
    } else {
      return sampleSoFar;
    }

    bannedValues.push(sampleValue);
  } while (sampleValue);

  return {};
}
