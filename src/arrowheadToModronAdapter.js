
const logger = require('./logger')

const arrowHeadRequests = require('./repositories/arrowHeadRequests');
const wotCreator = require('./wotCreator')
const tdFactory = require('./factory/tdFactory');
const gConfig = require('./config/conf.json')
const openApiRequest = require('./repositories/openApiRequest');
const modronRequests = require('./repositories/modronRequests')
const arrowHeadMetadata = require('./poolingMetadata/arrowHeadMetadata')

const arrowheadToModron = async () => {
    logger.info("ArrowHead WoT Adapter running...")
    const allServices = (await arrowHeadRequests.getAllServices()).data;

    const filteredServices = allServices.filter((service) => "systemName" in service.provider ?
        arrowHeadMetadata.isMonitoredService(service.provider.systemName) && !(arrowHeadMetadata.existService(service.id)) : false);
    const openApi = await Promise.all(filteredServices.map(openApiRequest.getOpenApi));

    const tds = filteredServices.map((service, i) => tdFactory(service, openApi[i]));

    tds.map((completeTd, index) => {
        wotCreator.createThing(completeTd).then(() => {
            logger.info(`adding ${completeTd.td.title} as an already instantiated Web Thing`);
            arrowHeadMetadata.addService(filteredServices[index].id);
            modronRequests
                .registerNewThing(`http://${gConfig.wot.host}:${gConfig.wot.port}/${completeTd.td.title.toLowerCase().replace(" ", "-")}`)
                .then(response => { logger.info(response); })
                .catch(error => { logger.error(error); });
        }).catch((err) => {
            logger.error(err)
        });
    })
}

module.exports = arrowheadToModron;