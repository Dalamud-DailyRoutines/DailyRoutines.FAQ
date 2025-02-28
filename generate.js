const fs = require('fs');
const path = require('path');
const glob = require('glob');
const frontmatter = require('front-matter');

const articlesDir = path.join(__dirname, 'articles');
const outputFile = path.join(__dirname, 'articles.json');

function generateIndex() {
    const categories = {};

    // 获取所有子文件夹作为分类
    const categoryDirs = glob.sync('articles/*/', { onlyDirectories: true });

    categoryDirs.forEach(categoryDir => {
        const categoryName = path.basename(categoryDir);
        const categoryArticles = [];
        
        // 获取分类目录下的文章
        const articleFiles = glob.sync(`${categoryDir}/**/*.md`);
        
        articleFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            const article = {
                ...frontmatter.data(content),
                category: categoryName,
                content: content,
                slug: path.basename(file, '.md')
            };
            categoryArticles.push(article);
        });

        categories[categoryName] = categoryArticles.sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
    });

    fs.writeFileSync(outputFile, JSON.stringify(categories, null, 2));
    console.log('Index generated successfully!');
}

generateIndex(); 