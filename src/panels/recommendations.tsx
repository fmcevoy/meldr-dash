import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { Technique } from "../tips/database.js";
import { getCategoryIcon } from "../tips/formatter.js";

interface RecommendationsProps {
  recommendations: Technique[];
}

export function Recommendations({
  recommendations,
}: RecommendationsProps): React.ReactElement {
  if (recommendations.length === 0) {
    return (
      <PanelBox title="Recommendations">
        <Box paddingX={1}>
          <Text color="gray">No recommendations</Text>
        </Box>
      </PanelBox>
    );
  }

  // Split into two columns
  const mid = Math.ceil(recommendations.length / 2);
  const left = recommendations.slice(0, mid);
  const right = recommendations.slice(mid);

  return (
    <PanelBox title="Recommendations">
      <Box paddingX={1} gap={2}>
        <Box flexDirection="column" flexBasis="50%">
          {left.map((t) => (
            <Text key={t.id}>
              {getCategoryIcon(t.category)} {t.title}
            </Text>
          ))}
        </Box>
        <Box flexDirection="column" flexBasis="50%">
          {right.map((t) => (
            <Text key={t.id}>
              {getCategoryIcon(t.category)} {t.title}
            </Text>
          ))}
        </Box>
      </Box>
    </PanelBox>
  );
}
