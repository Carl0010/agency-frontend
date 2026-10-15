// Keep color decisions in styles/tokens.css, including status and content colors.
const paletteUtility = /\b(?:bg|text|border|ring|outline|divide|fill|stroke|from|via|to|decoration|accent|placeholder)-(?:slate|gray|zinc|neutral|stone|blue|indigo|red|green|emerald|amber|yellow|teal|cyan|purple|pink|orange|violet|rose|sky|lime|fuchsia)-(?:50|[1-9]00|950)\b|\b(?:bg|text|border|ring|fill|stroke)-(?:white|black)\b/;
const literalColor = /(?:\[|^)(?:#[\da-f]{3,8}\b|(?:rgb|hsl|oklch)\()/i;

export default {
  rules: {
    'semantic-colors': {
      meta: {
        type: 'problem',
        schema: [],
        messages: { token: 'Use a semantic color from styles/tokens.css. See docs/frontend/DESIGN_SYSTEM.md.' },
      },
      create(context) {
        function check(node, value) {
          if (typeof value === 'string' && (paletteUtility.test(value) || literalColor.test(value))) {
            context.report({ node, messageId: 'token' });
          }
        }
        return {
          Literal(node) { check(node, node.value); },
          TemplateElement(node) { check(node, node.value.raw); },
        };
      },
    },
  },
};
