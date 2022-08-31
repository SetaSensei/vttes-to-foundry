

import * as moduleLib from './moduleLib.js'
import NPCActorImport from './NPCActor.js';
import PCActorImport from './PCActor.js';


const importToActor = async function importToActor(content, actor, compendiums = []) {
    await checkAndCreateCompendium('vttes-items', 'Item');
    await checkAndCreateCompendium(moduleLib.MACRO_COMP_NAME, 'Macro')
    
    ui.notifications.info(`Importing ...`)

    var isNPC = (getAttribCurrentInt(content, "npc") == 1)

    if (isNPC) {
        const imp = new NPCActorImport(actor)
        await imp.import(content, compendiums)
    } else {
        const imp = new PCActorImport(actor)
        await imp.import(content, compendiums)
    }

    ui.notifications.info(`Import successfull ! Actor ${actor.name} is playable`)


    async function checkAndCreateCompendium(compendiumName, compendiumType) {
        var compendium = game.packs.get(`world.${compendiumName}`);
        if (!compendium) {
            compendium = await CompendiumCollection.createCompendium({
                "name": compendiumName,
                "label": compendiumName,
                "path": `packs/${compendiumName}.db`,
                "type": compendiumType,
                "private": false,
                "entity": compendiumType,
                "system": "dnd5e",
                "package": "world",
                "relationships": {
                    "systems": [
                        { "id": "dnd5e"}
                    ]
                }
            });
        }
    }
}

function getAttribCurrent(content, key, defaultValue = '') {
    var property = getAttrib(content, key)

    if (!property) {
        return defaultValue
    }

    return property.current
}

function getAttribCurrentInt(content, key, defaultValue = 0) {
    var attrib = getAttribCurrent(content, key)
    if (attrib === '') {
        return defaultValue
    }
    return parseInt(getAttribCurrent(content, key))
}

function getAttrib(content, key) {
    return content.character.attribs.find(att => att.name === key)
}

export {
    importToActor
}