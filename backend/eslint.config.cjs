module.exports = [
  {
    ignores: ['node_modules/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        exports: 'writable',
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='query'] TemplateLiteral MemberExpression[object.name='req'][property.name='query']",
          message:
            'Do not interpolate req.query into SQL templates. Use parameterized values and allowlists.',
        },
        {
          selector:
            "CallExpression[callee.property.name='query'] TemplateLiteral MemberExpression[object.name='req'][property.name='params']",
          message:
            'Do not interpolate req.params into SQL templates. Use parameterized values and allowlists.',
        },
        {
          selector:
            "CallExpression[callee.property.name='query'] TemplateLiteral MemberExpression[object.name='req'][property.name='body']",
          message:
            'Do not interpolate req.body into SQL templates. Use parameterized values and allowlists.',
        },
      ],
    },
  },
];
