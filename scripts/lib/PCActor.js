import {
    DND5E
} from "../../../../systems/dnd5e/module/config.js";
import ActorImporter from "./ActorImporter.js";
import * as moduleLib from './moduleLib.js'


export default class PCActorImport extends ActorImporter {
    constructor(actor) {
        super(actor)
    }

    async import(content, compendiums) {
        await super.import(content, compendiums)

        var abilities = this.getAbilities();
        var traits = await this.embedFromCompendiums(['feat'], 'traits', {
            createAction: this.createFeat
        })
        var inventory = await this.embedFromCompendiums(['equipment'], 'inventory', {
            keyName: 'itemname',
            createAction: this.createItem,
            features: this.repeatingFeatures,
            transformAction: this.applyItemTranformation
        })
        var spells = await this.getAndPrepareSpells();

        await this.setClasses();

        var darkvision = this.getDarkvision(traits);
        var size = moduleLib.getSizeCode(this.getAttribCurrent("size"))
        await this.updatePCActorSheet(darkvision, size, abilities);

        this.applyProficiencies(inventory);

        var allItemsToCreate = [...inventory, ...traits, ...spells];
        await this.actor.createEmbeddedDocuments("Item", allItemsToCreate);


        if (this.content.character.defaulttoken && this.content.character.defaulttoken != '') {
            var tokenInfos = JSON.parse(this.content.character.defaulttoken);
            await this.updateToken(tokenInfos, darkvision);
        } else {
            await this.updateToken({
                name: this.actor.name,
                imgsrc: this.actor.img
            }, darkvision);
        }
    }

    async updateToken(tokenInfos, darkvision) {
        var actorToken = this.actor.data.token;
        await actorToken.update({
            name: tokenInfos.name,
            vision: true,
            dimSight: tokenInfos.night_vision_distance ?? darkvision,
            img: tokenInfos.imgsrc,
            displayName: tokenInfos.showname ? CONST.TOKEN_DISPLAY_MODES.ALWAYS : CONST.TOKEN_DISPLAY_MODES.NONE
        });
    }

    applyItemTranformation(content, objectToTransform, linkedFeature) {
        if (objectToTransform.type == 'equipment' || objectToTransform.type == 'weapon'){
            objectToTransform.data.equipped = linkedFeature['equipped'] ? linkedFeature['equipped'].current == 1 : true 
        }
    }

    applyProficiencies(inventory) {
        for (let idx = 0; idx < inventory.length; idx++) {
            const item = inventory[idx];
            if (item.type === 'weapon') {
                console.log(`${item.name} - ${item.data.weaponType}`);
                const wType = DND5E.weaponProficienciesMap[item.data.weaponType];

                if (this.actor.data.data.traits.weaponProf.value.includes(wType) || this.actor.data.data.traits.weaponProf.value.includes(item.name)) {
                    item.data.proficient = true;
                }
            }
        }
    }

    async setClasses() {
        await this.setActorMainClass();
        await this.setMultiClass();
    }

    async setMultiClass() {
        var multiClasses = this.getAttribsStartsWith('multiclass');
        if (multiClasses.length > 0) {
            var activeMultClasses = multiClasses.filter(sc => sc.name.endsWith('_flag') && sc.current === '1');

            for (let index = 0; index < activeMultClasses.length; index++) {
                const multClass = activeMultClasses[index];
                var key = multClass.name.substring(0, multClass.name.indexOf('_'));

                var level = this.getAttribCurrentInt(key + '_lvl');
                var multClassName = this.getAttribCurrent(key);
                var multClassSubName = this.getAttribCurrent(key + '_subclass');

                await this.setClass(multClassName, multClassSubName, level);
            }
        }
    }

    getPCDetails() {
        return {
            biography: {
                value: unescape(this.content.character.bio),
                public: ""
            },
            alignment: this.getAttribCurrent("alignment"),
            race: this.getAttribCurrent("race_display"),
            background: this.getAttribCurrent("background"),
            xp: {
                value: this.getAttribCurrentInt("experience")
            },
            appearance: "",
            trait: this.getAttribCurrent("personality_traits"),
            ideal: this.getAttribCurrent("ideals"),
            bond: this.getAttribCurrent("bonds"),
            flaw: this.getAttribCurrent("flaws"),
            age: this.getAttribCurrent("age"),
            height: this.getAttribCurrent("height"),
            weight: this.getAttribCurrent("weight"),
            eyes: this.getAttribCurrent("eyes"),
            skin: this.getAttribCurrent("skin"),
            hair: this.getAttribCurrent("hair"),
            level: this.getAttribCurrentInt("level")
        };
    }

    async updatePCActorSheet(darkvision, size, abilities) {
        var details = this.getPCDetails()

        var skills = this.getSkills(abilities)
        var tools = this.getToolProficiencies()

        var proficiencies = this.getGlobalProficiencies()

        await this.actor.update({
            name: this.content.character.name,
            img: this.content.character.avatar,
            data: {
                details: details,
                abilities: abilities,
                attributes: {
                    ac: {
                        value: this.getAttribCurrentInt("ac")
                    },
                    hp: this.getHp(),
                    init: {
                        mod: this.getAttribCurrentInt("initiative_bonus"),
                    },
                    movement: {
                        burrow: 0,
                        climb: 0,
                        fly: 0,
                        swim: 0,
                        walk: this.getAttribCurrentInt("speed"),
                        units: "ft",
                        hover: false
                    },
                    senses: {
                        darkvision: darkvision,
                        blindsight: 0,
                        tremorsense: 0,
                        truesight: 0,
                        units: "ft",
                        special: ""
                    },
                    spellcasting: this.getSpellcastingAbility(),
                    exhaustion: 0,
                    hd: 0,
                    prof: 1,
                    encumbrance: {
                        value: 0,
                        max: 120,
                        pct: 0,
                        encumbered: false
                    },
                },
                currency: {
                    pp: this.getAttribCurrentInt('pp'),
                    gp: this.getAttribCurrentInt('gp'),
                    ep: this.getAttribCurrentInt('ep'),
                    sp: this.getAttribCurrentInt('sp'),
                    cp: this.getAttribCurrentInt('cp')
                },
                skills: skills,
                traits: {
                    size: size,
                    di: {
                        value: [],
                        custom: ""
                    },
                    dr: {
                        value: [],
                        custom: ""
                    },
                    dv: {
                        value: [],
                        custom: ""
                    },
                    ci: {
                        value: [],
                        custom: ""
                    },
                    languages: {
                        value: this.getProficiency(proficiencies, "LANGUAGE"),
                        custom: this.getProficiencyAsCustom(proficiencies, "LANGUAGE")
                    },
                    weaponProf: {
                        value: this.getWeaponsProficiencies(proficiencies),
                        custom: this.getProficiencyAsCustom(proficiencies, "WEAPON")
                    },
                    armorProf: {
                        value: this.getArmorsProficiencies(proficiencies),
                        custom: this.getProficiencyAsCustom(proficiencies, "ARMOR")
                    },
                    toolProf: {
                        value: tools,
                        custom: tools.join(';')
                    }
                }
            }
        });
    }

    getToolProficiencies() {
        return this.getAttributesBySuffix("_toolname").reduce((acc, curr) => {
            acc.push(moduleLib.capitalizeFirstLetterOfEveryWord(curr.current));
            return acc;
        }, []);
    }
}