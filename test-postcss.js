const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');

postcss([tailwind])
  .process('@import "tailwindcss";', { from: 'src/app/globals.css' })
  .then(result => {
    console.log('PostCSS success!');
    // console.log(result.css);
  })
  .catch(err => {
    console.error('PostCSS error:');
    console.error(err);
  });
