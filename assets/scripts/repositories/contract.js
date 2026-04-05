(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const repositories = (app.repositories = app.repositories || {});

  const contractMethods = [
    "getClinic",
    "listAnimals",
    "createAnimal",
    "updateAnimal",
    "deleteAnimal",
    "getAnimal",
    "listAnimalVisits",
    "getVisit",
    "saveVisit",
    "deleteVisit",
    "listPregnancyChecks",
    "savePregnancyCheck",
    "saveVisitAttachment",
    "replaceVisitAttachments",
    "saveProtocolEvent",
    "replaceProtocolEvents",
  ];

  function createNotImplementedMethod(methodName) {
    return function () {
      throw new Error(`Repository method not implemented: ${methodName}`);
    };
  }

  repositories.contractMethods = contractMethods.slice();

  repositories.createContractSkeleton = function () {
    const skeleton = {};

    contractMethods.forEach((methodName) => {
      skeleton[methodName] = createNotImplementedMethod(methodName);
    });

    return skeleton;
  };

  repositories.assertContract = function (repository) {
    repositories.contractMethods.forEach((methodName) => {
      if (!repository || typeof repository[methodName] !== "function") {
        throw new Error(`Repository contract violation: missing method ${methodName}`);
      }
    });

    return repository;
  };
})();
