class Filter {
    async process(input) {
        throw new Error('Process method must be implemented');
    }
}

module.exports = Filter;
