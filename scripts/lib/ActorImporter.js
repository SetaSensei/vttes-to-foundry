import * as moduleLib from "./moduleLib.js";
import ItemFormat from "./itemFormat.js";
import * as spellLib from './spellLib.js'
import { DND5E } from "../../../../systems/dnd5e/dnd5e.mjs"

export default class ActorImporter {

    numberRegex = /\d+/g;

    constructor(actor) {
        this.actor = actor
        this.repeatingFeatures = {}
        this.repeatingFeaturesIds = {}
        this.usedAttacks = []
        this.darkvision = null
    }

    async import(content) {
        this.content = content
        this.extractRepeatings()
    }

    getAbilities() {
        return {
            str: this.getAbility('strength'),
            dex: this.getAbility('dexterity'),
            con: this.getAbility('constitution'),
            int: this.getAbility('intelligence'),
            wis: this.getAbility('wisdom'),
            cha: this.getAbility('charisma')
        };
    }

    getAbility(ability) {
        return {
            value: this.getAttribCurrentInt(ability),
            proficient: this.getAttribCurrent(ability + '_save_prof') == 0 ? 0 : 1,
            mod: this.getAttribCurrentInt(ability + '_mod'),
            prof: this.getAttribCurrentInt(ability + '_save_prof'),
            saveBonus: this.getAttribCurrentInt(ability + '_save_bonus'),
            checkBonus: this.getAttribCurrentInt(ability + '_bonus')
        };
    }

    getSkills(abilities) {
        var level = this.getAttribCurrentInt("level")
        var proficiencyModifier = this.getCalculatedProficiency(level)

        return {
            acr: this.getSkill(abilities, "acrobatics", "dex", proficiencyModifier),
            ani: this.getSkill(abilities, "animal_handling", "wis", proficiencyModifier),
            arc: this.getSkill(abilities, "arcana", "int", proficiencyModifier),
            ath: this.getSkill(abilities, "athletics", "str", proficiencyModifier),
            dec: this.getSkill(abilities, "deception", "cha", proficiencyModifier),
            his: this.getSkill(abilities, "history", "int", proficiencyModifier),
            ins: this.getSkill(abilities, "insight", "wis", proficiencyModifier),
            itm: this.getSkill(abilities, "intimidation", "cha", proficiencyModifier),
            inv: this.getSkill(abilities, "investigation", "int", proficiencyModifier),
            med: this.getSkill(abilities, "medicine", "wis", proficiencyModifier),
            nat: this.getSkill(abilities, "nature", "int", proficiencyModifier),
            prc: this.getSkill(abilities, "perception", "wis", proficiencyModifier),
            prf: this.getSkill(abilities, "performance", "cha", proficiencyModifier),
            per: this.getSkill(abilities, "persuasion", "cha", proficiencyModifier),
            rel: this.getSkill(abilities, "religion", "int", proficiencyModifier),
            slt: this.getSkill(abilities, "sleight_of_hand", "dex", proficiencyModifier),
            ste: this.getSkill(abilities, "stealth", "dex", proficiencyModifier),
            sur: this.getSkill(abilities, "survival", "wis", proficiencyModifier)
        };
    }

    getSkill(abilities, skillName, abilityShort, proficiency) {

        var isProficent = this.getAttribCurrent(skillName + "_prof").length > 0
        var skillMod = this.getAttribCurrentInt(skillName + "_bonus")
        var proficiencyType = 0
        var abilityMod = abilities[abilityShort].mod

        if (isProficent) {
            proficiencyType = (skillMod - abilityMod) / proficiency
        }

        var profValue = (isProficent ? proficiency : 0) * proficiencyType
        var passive = 10 + skillMod

        return {
            ability: abilityShort,
            bonus: 0,
            mod: abilityMod,
            passive: passive,
            prof: profValue,
            value: proficiencyType,
            total: skillMod
        };
    }

    getAttribCurrent(key, defaultValue = '') {
        var property = this.getAttrib(key)

        if (!property) {
            return defaultValue
        }

        return property.current
    }

    getAttrib(key, options = {
        throwIfNotFound: false,
        warnIfNotFound: false
    }) {
        var attrib = this.content.character.attribs.find(att => att.name === key)
        if (attrib || !(options.throwIfNotFound ?? false)) {
            return attrib
        }

        var errorMessage = `Attribute ${key} cannot be found inside the provided file. Make sure all attributes ('attribs') are set to lowercase`
        if (options.warnIfNotFound ?? false) {
            moduleLib.vttWarn(errorMessage, true)
            return null
        }
        moduleLib.vttError(errorMessage, true)
        throw `Attribute not found ${key}`
    }

    getAttribCurrentInt(key, defaultValue = 0) {
        var attrib = this.getAttribCurrent(key)
        if (attrib === '') {
            return defaultValue
        }
        return parseInt(attrib)
    }

    getCalculatedProficiency(level) {
        return Math.floor((level + 7) / 4);
    }

    async embedFromCompendiums(compendiumTypeNames, repeatingKeys, options = {
        keyName: 'name',
        transformAction: this.noop,
        createAction: null,
        correspondances: null
    }) {
        var readyToImport = []
        var notCreated = []
        var compendiums = []
        compendiumTypeNames.forEach(compendiumKey => {
            var comps = this.getCompendiumByType(compendiumKey);
            compendiums = [...compendiums, ...comps]
        });

        for (let idx = 0; idx < repeatingKeys.length; idx++) {
            const key = repeatingKeys[idx];
            var currentImport = []
            var {
                embedQueue: currentImport,
                creationQueue: notCreated
            } = await this.embedFromRepeating(compendiums, key, options.transformAction, compendiumTypeNames, options)

            moduleLib.vttLog(`${notCreated.length} items in ${key} were not found in compendiums of type ${key}`)

            if (options.createAction) {
                moduleLib.vttLog(`${key} items have create method. Iterating ...`)
                for (let idx = 0; idx < notCreated.length; idx++) {
                    const notFoundItem = notCreated[idx];
                    var element = await options.createAction(notFoundItem, key, options)
                    if (element != null) {
                        readyToImport.push(element)
                    }
                }
            }

            readyToImport = [...readyToImport, ...currentImport]
        }


        return readyToImport
    }

    async createFeat(feat, key, options) {
        var newFeat = {
            name: feat.name.current,
            type: 'feat',
            img: 'icons/commodities/tech/dial-meter-gauge-blue.webp',
            system: {
                description: {
                    value: feat.description ? feat.description.current : ''
                },
                requirements: feat.source_type ? feat.source_type.current : feat.source ? feat.source.current : '',
                source: moduleLib.SOURCE_MESSAGE
            }
        }

        return newFeat
    }


    async createItem(item, key, options) {
        var desc = await renderTemplate(moduleLib.getFolderPath() + 'templates/itemDescription.hbs', {
            properties: item.itemproperties ? item.itemproperties.current : '',
            content: item.itemcontent ? item.itemcontent.current : ''
        })

        var newItem = {
            name: item[options.keyName].current,
            type: 'loot',
            system: {
                description: {
                    value: desc
                },
                source: moduleLib.SOURCE_MESSAGE,
                quantity: item.itemcount ? item.itemcount.current : 1,
                weight: item.itemweight ? item.itemweight.current : 0,
                rarity: "common",
            }
        }

        moduleLib.vttLog(`Creating item : ${newItem.name}`)

        if (item.itemmodifiers) {
            var modifiers = item.itemmodifiers.current.split(',')
                .reduce((arr, curr) => {
                    var keyValue = curr.split(':')
                    if (keyValue[0] && keyValue[1]) {
                        arr[keyValue[0].trim()] = keyValue[1].trim()
                    }
                    return arr
                }, {})

            if (modifiers['AC']) {
                moduleLib.vttLog(`Item : ${newItem.name} identified as equipment`)

                var {
                    typeName: arType,
                    maxDex: maxDex
                } = moduleLib.getArmorType(modifiers['Item Type'])
                newItem.armor = {
                    value: parseInt(modifiers['AC']),
                    type: arType,
                    dex: maxDex
                }
                newItem.type = 'equipment'
                newItem.stealth = modifiers['Stealth'] ? modifiers['Stealth'] === 'Disadvantage' : false
            }
        }


        if (item.hasattack && item.hasattack.current == 1) {
            moduleLib.vttLog(`Item : ${newItem.name} identified as weapon`)

            newItem.damage = {}
            var features = options.features
            var damageParts = []
            var versatile = ''
            var attackIds = item.itemattackid.current.split(',')

            for (let idx = 0; idx < attackIds.length; idx++) {
                const attackId = attackIds[idx];
                var attackData = features['attack'][attackId]
                var attackValue = attackData.dmgbase.current.replace('ro', 'r')

                if (attackData.versatile_alt && attackData.versatile_alt.current == 1) {
                    versatile = `${attackValue} + @mod`
                    if (!newItem.properties) {
                        newItem.properties = {}
                    }
                    newItem.properties.ver = true
                    continue
                }
                damageParts.push([
                    `${attackValue} + @mod`,
                    attackData.dmgtype.current
                ])
            }

            newItem.damage.parts = damageParts
            newItem.damage.versatile = versatile
            newItem.actionType = moduleLib.getAttackTypeFromWeaponType(modifiers['Item Type'])

            newItem.properties = {
                "fin": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.fin),
                "lgt": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.lgt),
                "thr": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.thr),
                "amm": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.amm),
                "hvy": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.hvy),
                "fir": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.fir),
                "foc": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.foc),
                "lod": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.lod),
                "rch": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.rch),
                "rel": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.rel),
                "ret": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.ret),
                "spc": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.spc),
                "two": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.two),
                "ver": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.ver),
                "ada": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.ada),
                "mgc": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.mgc),
                "sil": item.itemproperties.current.includes(moduleLib.WEAPON_PROPERTIES.sil)
            }
            newItem.activation = {
                type: 'action',
                cost: 1,
                condition: ''
            }

            newItem.type = 'weapon'
        }



        return newItem
    }

    async getAndPrepareFeatures() {
        var {
            compendiumEntries,
            notFoundEntries
        } = await this.manageCompendium('feat', '_source', '_name')

        if (notFoundEntries.length > 0) {
            moduleLib.vttLog(notFoundEntries.length + ' features were not found in compendiums')
            moduleLib.vttLog(notFoundEntries)
        }

        for (let index = 0; index < notFoundEntries.length; index++) {
            const key = notFoundEntries[index];
            var attribs = this.getAttribsStartsWith(key);
            var desc = this.getAttribCurrent(key + '_description');
            var featName = this.getAttribCurrent(key + '_name')
            var require = attribs.find(a => a.name === key + '_source_type') ? this.getAttribCurrent(key + '_source_type') : this.getAttribCurrent(key + '_source');

            var newFeat = {
                name: featName,
                type: 'feat',
                system: {
                    description: {
                        value: desc
                    },
                    requirements: require
                }
            };

            await this.actor.createEmbeddedDocuments('Item', [newFeat])
        }
        return compendiumEntries;
    }

    getAttribsStartsWith(key) {
        return this.content.character.attribs.filter(att => att.name.startsWith(key))
    }



    async manageCompendium(compediumEntryType, entrySuffix, nameSuffix) {
        var itemsCompendium = this.getCompendiumByType(compediumEntryType);
        var compendiumEntries = []
        var notFoundEntries = []

        var items = this.getAttributesBySuffix(entrySuffix)

        for (let index = 0; index < items.length; index++) {
            var found = false

            const item = items[index];
            const key = this.getAttributeKey(item, entrySuffix)
            const itemName = this.getAttribCurrent(key + nameSuffix);

            for (let compIndex = 0; compIndex < itemsCompendium.length; compIndex++) {
                const compendium = itemsCompendium[compIndex];
                const itemFromComp = compendium.index.find(c => c.name.toLowerCase() === itemName.toLowerCase())
                if (itemFromComp != null) {
                    found = true
                    const compItem = await compendium.getDocument(itemFromComp._id, true)
                    var currObject = foundry.utils.deepClone(compItem.toObject())
                    compendiumEntries.push(currObject)
                    break
                }
            }
            if (!found) {
                notFoundEntries.push(key)
            }
        }

        return {
            compendiumEntries,
            notFoundEntries
        }
    }

    getCompendiumByType(compediumEntryType) {
        return game.packs.filter(p => p.index.some(i => i.type === compediumEntryType));
    }

    getAttributesBySuffix(suffix) {
        return this.content.character.attribs.filter(a => a.name.endsWith(suffix));
    }

    getAttributeKey(entry, suffix) {
        return entry.name.substring(0, entry.name.length - suffix.length);
    }

    // async getAndPrepareItems() {
    //     var {
    //         compendiumEntries,
    //         notFoundEntries
    //     } = await this.manageCompendium('equipment', '_itemname', '_itemname')

    //     if (notFoundEntries.length > 0) {
    //         moduleLib.vttLog(notFoundEntries.length + ' items were not found in compendiums')

    //         for (let index = 0; index < notFoundEntries.length; index++) {
    //             const notFoundItemKey = notFoundEntries[index];
    //             var itemInfos = this.getAttribsStartsWith(notFoundItemKey)

    //             var newItem = new ItemFormat()
    //             // newItem.name = 
    //             //moduleLib.vttLog(`${itemInfos.length} items were not found`)
    //             // console.log(itemInfos)
    //         }
    //     }

    //     return compendiumEntries
    // }

    extractRepeatings() {
        var input = 'repeating'

        var traits = this.getAttribsStartsWith(input)
        var arr = {}
        var ids = {}
        var spells = {}

        traits.forEach(t => {
            var idCut = t.name.indexOf('_-')
            var propCut = t.name.indexOf('_', idCut + 2)
            var objType = t.name.substring(input.length + 1, idCut)
            var id = t.name.substring(idCut + 1, propCut)
            var propName = t.name.substring(propCut + 1)

            if (!arr[objType]) {
                arr[objType] = {}
                ids[objType] = []
            }
            if (!arr[objType][id]) {
                arr[objType][id] = { _id: id }
                ids[objType].push(id)
            }
            arr[objType][id][propName] = {
                current: t.current,
                max: t.max
            }
            if (propName == 'spelllevel') {
                spells[id] = { level: t.current }
            }
        })

        this.repeatingFeatures = arr
        this.repeatingFeaturesIds = ids
        this.spellsLevelList = spells

        return {
            arr,
            ids
        }
    }

    async getAndPrepareSpells() {
        var {
            compendiumEntries,
            notFoundEntries
        } = await this.manageCompendium('spell', '_spellname', '_spellname')

        if (notFoundEntries.length > 0) {
            moduleLib.vttLog(notFoundEntries.length + ' spells were not found in compendiums')
            moduleLib.vttLog(notFoundEntries)

            notFoundEntries.forEach(entry => {
                var entryKeyCut = entry.indexOf('_-');
                var key = entry.substring(entryKeyCut + 1);

                moduleLib.vttLog(key + ' goes to level ' + this.spellsLevelList[key].level);

                var spellInfos = this.repeatingFeatures['spell-' + this.spellsLevelList[key].level][key];
                var spell = this.createSpell(spellInfos);
                compendiumEntries.push(spell)
            })
        }

        return compendiumEntries
    }

    applySpellTranformation(content, objectToTransform, linkedFeature, options) {
        moduleLib.setItemGlobalOptions(options, objectToTransform);

        objectToTransform.preparation = spellLib.getPreparation(linkedFeature)
    }



    createSpell(spellInfos, key, options) {

        if (!spellInfos.spellcastingtime) {
            moduleLib.vttWarn(`Spell ${spellInfos.spellname.current} cannot be imported (reason : no spell casting time)`, true)
            return null
        }

        var activation = spellLib.getSpellActivation(spellInfos);
        var spellDuration = spellLib.getSpellDuration(spellInfos);
        var range = spellLib.getSpellRange(spellInfos);
        var target = spellLib.getSpellTarget(spellInfos);
        var actionType = spellLib.getActionType(spellInfos);
        var damage = spellLib.getDamages(spellInfos);
        var scaling = spellLib.getScaling(spellInfos);
        var components = spellLib.getComponents(spellInfos);
        var materials = spellLib.getMaterials(spellInfos);
        var save = spellLib.getSpellSave(spellInfos);
        var school = spellLib.getSpellSchool(spellInfos);
        var preparation = spellLib.getPreparation(spellInfos)
        var icon = spellLib.getIcon(spellInfos)
        var spellLevel = spellLib.getSpellLevel(spellInfos, key)

        var newSpell = {
            type: "spell",
            name: spellInfos.spellname.current,
            img: icon,
            system: {
                level: spellLevel,
                description: {
                    value: `${spellInfos.spelldescription.current}<p>${spellInfos.spelltarget ? spellInfos.spelltarget.current : ''}<p>${spellInfos.spellathigherlevels ? spellInfos.spellathigherlevels.current : ''}`
                },
                source: "Imported by VTTES2Foundry",
                activation: activation,
                duration: spellDuration,
                target: target,
                range: range,
                actionType: actionType,
                damage: damage,
                scaling: scaling,
                components: components,
                materials: materials,
                save: save,
                school: school,
                preparation: preparation,
            }
        };

        return newSpell;
    }

    async setActorMainClass() {
        var className = this.getAttribCurrent("class")
        var subClassName = this.getAttribCurrent("subclass")
        var classLevel = this.getAttribCurrentInt("base_level")

        return await this.setClass(className, subClassName, classLevel)
    }

    async setClass(className, subClassName, classLevel) {
        var useClass = null
        var foundSubClass = false

        var lowerClassName = className.toLowerCase()
        var lowerSubClassName = subClassName.toLowerCase()

        var classCompendium = this.getCompendiumByType("class")

        moduleLib.vttLog(`Looking up ${className} (${subClassName}) in compendiums`)
        for (let compIndex = 0; compIndex < classCompendium.length; compIndex++) {
            const compendium = classCompendium[compIndex];
            const classesFromComp = compendium.index.filter(c => c.name.toLowerCase() === lowerClassName || c.name.toLowerCase().includes(lowerClassName))
            moduleLib.vttLog(`Found ${classesFromComp.length} matching classes on compendium ${compendium.metadata.name}`)
            if (classesFromComp.length > 0) {
                for (let index = 0; index < classesFromComp.length; index++) {
                    const classFromComp = classesFromComp[index];
                    const compendiumClass = await compendium.getDocument(classFromComp._id)

                    if (compendiumClass.subclass === subClassName) {
                        moduleLib.vttLog(`Found Subclass ${compendiumClass.subclass}`)
                        useClass = compendiumClass
                        foundSubClass = true
                        break
                    }
                    if (!compendiumClass.subclass || compendiumClass.subclass === '') {
                        if (compendiumClass.name.toLowerCase().includes(lowerSubClassName)) {
                            moduleLib.vttLog(`Found class & subclass by name ${className} (${subClassName}) as ${compendiumClass.name}`)
                            useClass = compendiumClass
                            foundSubClass = true
                            break
                        } else if (compendiumClass.name.toLowerCase() === lowerClassName) {
                            moduleLib.vttLog('Found base class')
                            useClass = compendiumClass
                        } else {
                            moduleLib.vttLog(`Class ${compendiumClass.name} is neither base class nor subclass, discarding`)
                        }
                    }
                }
            }
            if (foundSubClass) {
                break
            }

        }

        if (!useClass) {
            moduleLib.vttWarn(`Class ${className} with subclass ${subClassName} cannot be found in any of the game's compendium`, true)
            return null
        }

        var newClass = this.getOverridenClassData(className, useClass, subClassName, classLevel)
        await this.actor.createEmbeddedDocuments('Item', [newClass])

        return newClass
    }

    getOverridenClassData(className, sourceClass, subClassName, level = 1) {
        // if (!sourceClass.spellcasting) {
        //     sourceClass.spellcasting = {
        //         progression: "none",
        //         ability: ""
        //     }
        // }
        var clonedClass = foundry.utils.deepClone(sourceClass.toObject())
        // {
        //     name: className,
        //     type: "class",
        //     img: sourceClass.img,
        //     system: sourceClass.data
        // }
        clonedClass.system.levels = level
        // clonedClass.subclass = subClassName

        // if (!clonedClass.spellcasting) {
        //     clonedClass.spellcasting = {
        //         progression: "none",
        //         ability: ""
        //     }
        // }

        return clonedClass;
    }

    setDarkvision(actorFeats) {
        this.darkvision = 0

        var darkvisionEntry = actorFeats.find(a => a.name.toLowerCase() === 'darkvision');

        if (darkvisionEntry) {
            var darkVisionDesc = darkvisionEntry.system.description.value
            var regexOutput = this.numberRegex.exec(darkVisionDesc);
            if (regexOutput && regexOutput.length > 0) {
                this.darkvision = parseInt(regexOutput[0])
            }
        }
    }

    getGlobalProficiencies() {
        return this.getOrderedAttributesBySuffix('_prof_type')
    }

    getOrderedAttributesBySuffix(suffix) {
        return this.getAttributesBySuffix(suffix).reduce((acc, curr) => {
            var key = curr.current;
            var value = this.getAttributeKey(curr, suffix);
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(value);
            return acc;
        }, {});
    }

    getSpellcastingAbility() {
        var key = "spellcasting_ability"

        var abilityName = this.getAttribCurrent(key)
        if (abilityName.length <= 2) {
            return ""
        }

        return abilityName.substring(2, abilityName.length - 6).substring(0, 3);
    }

    getArmorsProficiencies(proficiencies) {
        const nameTransform = function (name) {
            if (name === 'shields') {
                return DND5E.armorProficienciesMap['shield']
            }
            name = name.replace('armor', '').trim()
            return DND5E.armorProficienciesMap[name]
        }

        const identify = function (profName) {
            var found = false
            for (var prop in DND5E.armorProficienciesMap) {
                if (DND5E.armorProficienciesMap[prop] == profName) {
                    found = true
                }
            }
            return found || DND5E.armorIds[profName]
        }

        var output = { found: [], notFound: [] }

        this.getProficiencyAsFoundAndNotFound(proficiencies, 'ARMOR', identify, output.found, output.notFound, nameTransform)

        return { valid: output.found, customList: output.notFound.join(';') }
    }

    getWeaponsProficiencies(proficiencies) {
        const nameTransform = function (nameInput) {
            const name = nameInput.toLowerCase()
            var correspondances = [
                { key: "simple weapons", value: "sim" },
                { key: "martial weapons", value: "mar" },
                { key: "hand crossbow", value: "handcrossbow" },
                { key: "heavy crossbow", value: "heavycrossbow" },
                { key: "light crossbow", value: "lightcrossbow" }
            ]

            var output = correspondances.find(c => c.key == name)
            if (output != null) {
                return output.value
            }
            return name
        }

        const identify = function (profName) {
            return DND5E.weaponIds[profName] || profName == 'sim' || profName == 'mar'
        }

        var output = { found: [], notFound: [] }

        this.getProficiencyAsFoundAndNotFound(proficiencies, 'WEAPON', identify, output.found, output.notFound, nameTransform)
        return { valid: output.found, customList: output.notFound.join(';') }
    }

    getLanguagesProficiencies(proficiencies) {
        const nameTransform = function (name) {
            var correspondances = [
                { key: "thieves' cant", value: "cant" },
                { key: "deep speech", value: "deep" }
            ]

            var output = correspondances.find(c => c.key == name)
            if (output != null) {
                return output.value
            }
            return name
        }

        const identify = function (profName) {
            return DND5E.languages[profName]
        }

        var output = { found: [], notFound: [] }

        this.getProficiencyAsFoundAndNotFound(proficiencies, 'LANGUAGE', identify, output.found, output.notFound, nameTransform)

        return { valid: output.found, customList: output.notFound.join(';') }
    }

    getProficiencyAsFoundAndNotFound(proficiencies, profKey, identify, found = [], notFound = [], transform = null) {
        var keys = proficiencies[profKey]
        if (!keys) {
            return
        }

        keys.forEach(key => {
            var profName = this.getAttribCurrent(key + "_name")
            var transformedName = profName.toLowerCase()
            if (transform) {
                transformedName = transform(transformedName)
            }
            if (identify(transformedName)) {
                found.push(transformedName)
            } else {
                notFound.push(profName)
            }
        });
    }

    getProficiency(proficiencies, profKey, transform = null, toKeyValue = false) {
        var keys = proficiencies[profKey]
        if (!keys) {
            return 'none'
        }
        var values = keys.reduce((arr, curr) => {
            var profName = this.getAttribCurrent(curr + "_name").toLowerCase()
            if (transform) {
                profName = transform(profName)
            }
            arr.push(profName)
            return arr
        }, [])

        return values
    }

    getProficiencyAsCustom(proficiencies, profKey) {
        var keys = proficiencies[profKey]
        if (!keys) {
            return 'none'
        }
        var values = keys.reduce((arr, curr) => {
            var profName = this.getAttribCurrent(curr + "_name").toLowerCase()
            arr.push(profName)
            return arr
        }, [])

        if (values && values.length > 0) {
            return values.join(';')
        }
        return 'none'
    }

    getHp() {
        var hpAttrib = this.getAttrib("hp", {
            warnIfNotFound: true
        })

        if (!hpAttrib) {
            moduleLib.vttWarn(`The attribute hp was not found. Make sure all attributes names (attribs) are set in lowercase`, true)
            return
        }
        return {
            value: parseInt(hpAttrib.current),
            max: parseInt(hpAttrib.max),
            temp: 0,
            tempmax: 0
        };
    }

    noop() { }

    async embedFromRepeating(compendiums, repeatingKey, transformAction = this.noop, typeList = [], options = {
        keyName: 'name',
        correspondances: null
    }) {
        var features = this.repeatingFeatures[repeatingKey]
        var featureIds = this.repeatingFeaturesIds[repeatingKey]
        var embedQueue = []
        var creationQueue = []

        if (!options.keyName) {
            options.keyName = 'name'
        }

        if (featureIds) {
            for (let featIndex = 0; featIndex < featureIds.length; featIndex++) {
                const featId = featureIds[featIndex]
                const currFeat = features[featId]
                if (!currFeat[options.keyName] || currFeat[options.keyName].current == '') {
                    moduleLib.vttWarn(`Current feat (${featId}) from key ${repeatingKey} has no name on property ${options.keyName}.`, true)
                    continue
                }
                const featNamesForSearch = moduleLib.getNamesForSearch(currFeat[options.keyName].current, options.strict ?? false)
                var found = false

                for (let cpdIdx = 0; cpdIdx < compendiums.length; cpdIdx++) {
                    const compendium = compendiums[cpdIdx];

                    for (let idx = 0; idx < featNamesForSearch.names.length; idx++) {
                        var nameSearch = featNamesForSearch.names[idx];

                        if (options.correspondances) {
                            var corr = options.correspondances.filter(c => c.key == featNamesForSearch.names[0])
                            if (corr.length == 1) {
                                nameSearch = corr[0].value
                                featNamesForSearch.hasFlavorName = true
                            }
                        }

                        var mfIndex = compendium.index.find(m => m.name.toLowerCase() === nameSearch && typeList.includes(m.type))

                        if (mfIndex) {
                            found = true

                            moduleLib.vttLog(`${nameSearch} found in compendium ${compendium.metadata.name}`)

                            var feature = await compendium.getDocument(mfIndex._id)
                            var currObject = foundry.utils.deepClone(feature.toObject())

                            var transformOptions = featNamesForSearch.hasFlavorName ? { flavorName: currFeat[options.keyName].current } : {}

                            transformAction(this.content, currObject, currFeat, transformOptions)
                            embedQueue.push(currObject)

                            if (currFeat['itemattackid']) {
                                moduleLib.vttLog(`${currFeat[options.keyName].current} has attackid`)
                                this.usedAttacks.push(currFeat['itemattackid'].current)
                            }
                            break
                        }
                    }

                    if (found) {
                        break
                    }

                }
                if (!found) {
                    moduleLib.vttLog(`EmbedFromRepeating - ${currFeat[options.keyName].current} not found in compendiums of type ${repeatingKey} - Adding it to creation queue`)
                    creationQueue.push(currFeat)
                }
            }
        }

        return {
            embedQueue,
            creationQueue
        }
    }

    getTokenSetup() {
        var tokenContent = {
            name: this.actor.name,
            imgsrc: this.actor.img
        }

        if (this.content.character.defaulttoken && this.content.character.defaulttoken != '') {
            tokenContent = JSON.parse(this.content.character.defaulttoken);
        }

        return {
            name: tokenContent.name,
            sight: { enabled: true, visionMode: 'basic' },
            // dimSight: tokenContent.night_vision_distance ?? this.darkvision,
            texture: {
                src: tokenContent.imgsrc
            },
            displayName: tokenContent.showname ? CONST.TOKEN_DISPLAY_MODES.ALWAYS : CONST.TOKEN_DISPLAY_MODES.NONE
        }
    }
}