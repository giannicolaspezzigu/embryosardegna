(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  app.session = {
    addStructure(side, structure) {
      app.state.structs[side].push(structure);
      return structure;
    },

    getStructures(side) {
      return app.state.structs[side].slice();
    },

    removeStructureAt(side, position) {
      const list = app.state.structs[side];

      for (let index = list.length - 1; index >= 0; index -= 1) {
        const structure = list[index];
        const radius =
          structure.type === "fol" || structure.type === "cyst"
            ? Math.max(8, (structure.size || 6) * 3.2)
            : 16;
        const deltaX = position.x - (structure.x + radius - 1);
        const deltaY = position.y - (structure.y - radius + 2);

        if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) < 9) {
          return list.splice(index, 1)[0];
        }
      }

      return null;
    },

    getFollicles(side) {
      return app.state.structs[side].filter((structure) => structure.type === "fol");
    },

    getSummary(side) {
      const follicles = this.getFollicles(side);
      const averageSize =
        follicles.length > 0
          ? follicles.reduce((total, follicle) => total + follicle.size, 0) / follicles.length
          : null;

      return {
        follicles: follicles.length,
        averageSize,
        ovulations: app.state.structs[side].filter((structure) => structure.type === "ov").length,
        corporaLutea: app.state.structs[side].filter((structure) => structure.type === "cl").length,
        cysts: app.state.structs[side].filter((structure) => structure.type === "cyst").length,
      };
    },

    getCountsForSide(side) {
      const follicles = this.getFollicles(side);
      const follicleSizes = follicles.map((follicle) => follicle.size);

      return {
        totalFollicles: follicles.length,
        smallFollicles: follicles.filter((follicle) => follicle.size < 3).length,
        mediumFollicles: follicles.filter((follicle) => follicle.size >= 3 && follicle.size <= 5).length,
        largeFollicles: follicles.filter((follicle) => follicle.size > 5).length,
        ovulations: app.state.structs[side].filter((structure) => structure.type === "ov").length,
        corporaLutea: app.state.structs[side].filter((structure) => structure.type === "cl").length,
        cysts: app.state.structs[side].filter((structure) => structure.type === "cyst").length,
        averageFollicleSizeMm: follicleSizes.length
          ? follicleSizes.reduce((total, size) => total + size, 0) / follicleSizes.length
          : null,
        largestFollicleMm: follicleSizes.length ? Math.max.apply(null, follicleSizes) : null,
      };
    },

    getTotalCounts() {
      const left = this.getCountsForSide("L");
      const right = this.getCountsForSide("R");

      return {
        totalFollicles: left.totalFollicles + right.totalFollicles,
        smallFollicles: left.smallFollicles + right.smallFollicles,
        mediumFollicles: left.mediumFollicles + right.mediumFollicles,
        largeFollicles: left.largeFollicles + right.largeFollicles,
        ovulations: left.ovulations + right.ovulations,
        corporaLutea: left.corporaLutea + right.corporaLutea,
        cysts: left.cysts + right.cysts,
      };
    },

    getStats() {
      const left = this.getCountsForSide("L");
      const right = this.getCountsForSide("R");

      return {
        total: { L: left.totalFollicles, R: right.totalFollicles, all: left.totalFollicles + right.totalFollicles },
        small: { L: left.smallFollicles, R: right.smallFollicles, all: left.smallFollicles + right.smallFollicles },
        medium: { L: left.mediumFollicles, R: right.mediumFollicles, all: left.mediumFollicles + right.mediumFollicles },
        large: { L: left.largeFollicles, R: right.largeFollicles, all: left.largeFollicles + right.largeFollicles },
      };
    },
  };
})();
