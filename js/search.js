class SearchEngine {
    constructor() {
        this.index = null;
    }

    async init() {
        await this.buildIndex();
    }

    async buildIndex() {
        const { categories } = await fetch(CONFIG.indexFile).then(r => r.json());
        const documents = [];
        
        for (const category of categories) {
            for (const article of category.articles) {
                const response = await fetch(`${CONFIG.articlesPath}/${category.name}/${article.slug}.md`);
                const content = await response.text();
                documents.push({
                    id: `${category.name}/${article.slug}`,
                    title: article.title,
                    content: content.replace(/#+/g, ''),
                    category: category.name
                });
            }
        }

        this.index = new FlexSearch.Document({
            document: {
                id: "id",
                index: ["title", "content"],
                store: ["title", "category"]
            }
        });
        
        documents.forEach(doc => this.index.add(doc));
    }

    search(query) {
        return this.index.search(query, {
            limit: 10,
            suggest: true,
            enrich: true
        }).flatMap(result => result.result);
    }
} 