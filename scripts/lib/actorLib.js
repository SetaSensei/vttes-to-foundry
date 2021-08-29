

import {
    vttLog
} from './moduleLib.js'
import NPCActorImport from './NPCActor.js';
import PCActorImport from './PCActor.js';


const importToActor = async function importToActor(content, actor, compendiums = []) {
    var vttesComp = game.packs.get('world.vttes-items')
    if (!vttesComp) {
        vttesComp = await CompendiumCollection.createCompendium({
            "name": "vttes-items",
            "label": "vttes-items",
            "path": "packs/from-vttes.db",
            "private": false,
            "entity": "Item",
            "system": "dnd5e",
            "package": "world"
        })
    }

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