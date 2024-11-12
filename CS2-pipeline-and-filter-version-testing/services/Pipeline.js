class Pipeline {
    constructor() {
        this.filters = [];
    }

    addFilter(filter) {
        this.filters.push(filter);
        return this;
    }

    async process(input) {
        let result = input;
        for (const filter of this.filters) {
            result = await filter.process(result);
        }
        return result;
    }
}

module.exports = Pipeline;
