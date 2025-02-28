const fs = require('fs');
const path = require('path');

const articlesDir = path.join(__dirname, 'articles');
const outputFile = path.join(__dirname, 'articles.json');

function generateIndex() {
    const categories = fs.readdirSync(articlesDir)
        .filter(file => fs.statSync(path.join(articlesDir, file)).isDirectory())
        .map(category => {
            const categoryPath = path.join(articlesDir, category);
            const articles = fs.readdirSync(categoryPath)
                .filter(file => file.endsWith('.md'))
                .map(file => {
                    const slug = path.basename(file, '.md');
                    const content = fs.readFileSync(path.join(categoryPath, file), 'utf8');
                    const title = content.match(/^#\s+(.+)/m)?.[1] || slug;
                    return { title, slug };
                });
            return { 
                name: category.replace(/-/g, ' '),
                articles 
            };
        });

    fs.writeFileSync(outputFile, JSON.stringify(categories, null, 2));
    console.log('Index generated successfully!');
}

generateIndex(); 