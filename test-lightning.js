try {
  const lightningcss = require('lightningcss');
  console.log('LightningCSS loaded successfully');
  const result = lightningcss.transform({
    filename: 'test.css',
    code: Buffer.from('.foo { color: red }'),
    minify: true
  });
  console.log('Transform result:', result.code.toString());
} catch (e) {
  console.error('Error loading or running LightningCSS:');
  console.error(e);
}
