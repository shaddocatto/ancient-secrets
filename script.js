// Character state
let character = {
    // Added fields for character and player names
    characterName: '',
    playerName: '',
    heritage: '',
    concept: '',
    position: '',
    trouble: '',
    secret: '',
    skills: {
        strength: 0,
        warfare: 0,
        psyche: 0,
        endurance: 0,
        status: 0,
        intrigue: 0,
        hunting: 0,
        lore: 0
    },
    powers: [],
    extras: [],
    totalPoints: 60,
    usedPoints: 0,
    heritagePoints: 0
};

let extraIdCounter = 0;
let featureInstanceCounter = 0;
let gmPowerCosts = {};

// Keep track of the last known good extras so that accidental blank saves
// do not wipe out user-created extras.  Each time saveCharacter() is
// called with a non-empty extras array, this variable is updated with
// a deep clone of the current extras.  If saveCharacter() is invoked
// when extras are unexpectedly empty, the lastGoodExtras will be used
// to restore them before persisting.
let lastGoodExtras = [];

// Multi-character support: in-memory list and current character ID
// savedCharacters holds an array of { id: string, data: object }
let savedCharacters = [];
let currentCharacterId = null;

// Heritage management
function updateHeritage() {
    const heritage = document.getElementById('heritage').value;
    const heritageInfo = document.getElementById('heritageInfo');
    
    character.heritage = heritage;
    
    let heritageDescription = '';
    let heritagePoints = 0;
    
    // Reset heritage-specific power states
    document.getElementById('pattern-adept').disabled = false;
    document.getElementById('shapeshifting').disabled = false;
    
    switch(heritage) {
        case 'recognized-amber':
            heritageDescription = 'Free Pattern Adept power. Gains Court position, Blood Curse, and Slow Regeneration.';
            heritagePoints = 0;
            // Auto-enable Pattern Adept by default, but allow player to uncheck it.  Do not disable the checkbox.
            document.getElementById('pattern-adept').checked = true;
            break;
        case 'unrecognized-amber':
            heritageDescription = 'Gain 5 points. Has Blood Curse and Slow Regeneration. Work with GM for details.';
            heritagePoints = 5;
            break;
        case 'chaos':
            heritageDescription = 'Gain 2 points. Free Shapeshifting power.';
            heritagePoints = 2;
            // Auto-enable Shapeshifting by default, but allow player to uncheck it.  Do not disable the checkbox.
            document.getElementById('shapeshifting').checked = true;
            break;
        case 'both':
            heritageDescription = 'Costs 3 points. Recognized status, Court position, Blood Curse, Slow Regeneration, Pattern, and Shapeshifting.';
            heritagePoints = -3;
            // Auto-enable both Pattern and Shapeshifting by default, but allow player to uncheck them.  Do not disable the checkboxes.
            document.getElementById('pattern-adept').checked = true;
            document.getElementById('shapeshifting').checked = true;
            break;
        case 'other':
            heritageDescription = 'Gain 6 points. Work with GM to create custom heritage.';
            heritagePoints = 6;
            break;
        default:
            heritageDescription = '';
            heritagePoints = 0;
            break;
    }
    
    character.heritagePoints = heritagePoints;
    
    if (heritageDescription) {
        heritageInfo.innerHTML = heritageDescription;
        heritageInfo.style.display = 'block';
    } else {
        heritageInfo.style.display = 'none';
    }
    
    updatePointsDisplay();
    updatePowers();
    saveCharacter();
}

// Skills management
function updateSkills() {
    const skills = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
    
    skills.forEach(skill => {
        const value = parseInt(document.getElementById(skill).value) || 0;
        character.skills[skill] = value;
        // Costs for skills are always 1:1 with the positive value, but we no longer display
        // these per-skill costs in the UI.  Good Stuff calculations still rely on the
        // underlying numeric value stored in character.skills.
    });
    
    updatePointsDisplay();
    saveCharacter();
}

// GM Power cost management
function updateGMPowerCost(powerId) {
    const costInput = document.getElementById(powerId + '-manual-cost');
    const cost = parseInt(costInput.value) || 0;
    gmPowerCosts[powerId] = cost;
    
    const costSpan = document.getElementById(powerId + '-cost');
    costSpan.textContent = cost > 0 ? cost.toString() : 'GM';
    
    updatePointsDisplay();
    saveCharacter();
}

// Powers management
function updatePowers() {
    const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
    character.powers = [];
    
    powerElements.forEach(element => {
        if (element.checked) {
            let powerCost = parseInt(element.dataset.cost);
            
            // Check if this is a GM power with manual cost
            if (element.dataset.gmCost === 'true' && gmPowerCosts[element.id]) {
                powerCost = gmPowerCosts[element.id];
            }
            
            character.powers.push({
                id: element.id,
                cost: powerCost,
                prereq: element.dataset.prereq,
                credit: element.dataset.credit
            });
        }
    });
    
    // Check prerequisites and enable/disable powers
    powerElements.forEach(element => {
        const prereq = element.dataset.prereq;
        if (prereq && !element.disabled) {
            const prereqMet = document.getElementById(prereq).checked;
            element.parentElement.parentElement.classList.toggle('disabled', !prereqMet);
            if (!prereqMet && element.checked) {
                element.checked = false;
            }
        }
    });
    
    // Update power costs display
    updatePowerCosts();
    updatePointsDisplay();
    saveCharacter();
}

function updatePowerCosts() {
    const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
    
    powerElements.forEach(element => {
        const powerId = element.id;
        const baseCost = parseInt(element.dataset.cost);
        const costSpan = document.getElementById(powerId + '-cost');
        
        if (!costSpan) return;
        
        let finalCost = baseCost;
        let isFree = false;
        let isDiscounted = false;
        
        // Check if this is a GM power
        if (element.dataset.gmCost === 'true') {
            const manualCost = gmPowerCosts[powerId] || 0;
            finalCost = manualCost;
            costSpan.textContent = manualCost > 0 ? manualCost.toString() : 'GM';
            costSpan.className = 'power-cost gm';
            return;
        }
        
        // Check if this power is free from heritage
        if (isHeritageFreePower(powerId)) {
            finalCost = 0;
            isFree = true;
        } else {
            // Apply credits from other powers
            if (element.dataset.credit && element.checked) {
                const credits = element.dataset.credit.split(',');
                credits.forEach(credit => {
                    const [powerName, creditValue] = credit.split(':');
                    const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                    if (hasPowerForCredit) {
                        finalCost += parseInt(creditValue); // creditValue is already negative
                        isDiscounted = true;
                    }
                });
            }
        }
        
        // Update the display
        costSpan.textContent = finalCost === 0 ? 'Free' : finalCost.toString();
        costSpan.className = 'power-cost';
        
        if (isFree) {
            costSpan.classList.add('free');
        } else if (isDiscounted) {
            costSpan.classList.add('discounted');
        }
    });
}

function isHeritageFreePower(powerId) {
    const heritage = character.heritage;
    if (heritage === 'recognized-amber' && powerId === 'pattern-adept') return true;
    if (heritage === 'chaos' && powerId === 'shapeshifting') return true;
    if (heritage === 'both' && (powerId === 'pattern-adept' || powerId === 'shapeshifting')) return true;
    return false;
}

// Extras management
function addExtra() {
    const extraId = 'extra_' + (++extraIdCounter);
    const extra = {
        id: extraId,
        name: '',
        type: '',
        isSimple: true,
        // Support multiple aspects for simple extras.  Initialize with a single empty string.
        simpleAspects: [''],
        simpleAspect: '', // legacy field retained for backward compatibility
        features: [],
        isEditing: true
    };
    
    character.extras.push(extra);
    renderExtra(extra);
    updatePointsDisplay();
}

function removeExtra(extraId) {
    character.extras = character.extras.filter(e => e.id !== extraId);
    document.getElementById(extraId).remove();
    updatePointsDisplay();
    saveCharacter();
}

function renderExtra(extra) {
    const container = document.getElementById('extrasContainer');
    const extraDiv = document.getElementById(extra.id) || document.createElement('div');
    
    if (!extraDiv.id) {
        extraDiv.id = extra.id;
        extraDiv.className = 'power-category';
        extraDiv.style.marginBottom = '20px';
        container.appendChild(extraDiv);
    }
    
    if (extra.isEditing) {
        extraDiv.innerHTML = renderExtraEditMode(extra);
    } else {
        extraDiv.innerHTML = renderExtraDisplayMode(extra);
    }
}

function renderExtraEditMode(extra) {
    // Build HTML for multiple simple aspect inputs.  Extra.simpleAspects will always
    // contain at least one element (initialized on extra creation or normalized
    // during load).  Additional aspects beyond the first cost 1 point each.
    const aspectsHtml = (extra.simpleAspects && Array.isArray(extra.simpleAspects) ? extra.simpleAspects : [extra.simpleAspect || '']).map((asp, idx) => {
        return `
            <div class="aspect-field" style="display:flex; align-items:center; margin-bottom:5px;">
                <input type="text" id="${extra.id}_aspect_${idx}" value="${asp || ''}" placeholder="e.g., Swift as the Wind"
                       onchange="updateExtraAspect('${extra.id}', ${idx})" style="flex:1; margin-right:5px;">
                ${idx > 0 ? `<button type="button" class="remove-instance-btn" onclick="removeSimpleAspect('${extra.id}', ${idx})">×</button>` : ''}
            </div>
        `;
    }).join('');

    return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0;">Extra: ${extra.name || 'Unnamed'}</h3>
            <div>
                <button type="button" class="export-btn" onclick="saveExtra('${extra.id}')" style="font-size: 0.8em; padding: 5px 10px; margin-right: 5px;">Save</button>
                <button type="button" class="reset-btn" onclick="removeExtra('${extra.id}')" style="font-size: 0.8em; padding: 5px 10px; margin: 0;">Remove</button>
            </div>
        </div>
        
        <div class="form-group">
            <label>Name:</label>
            <input type="text" id="${extra.id}_name" value="${extra.name}" placeholder="e.g., Loyal Steed, Ancestral Sword, Shadow Realm" onchange="updateExtraName('${extra.id}')">
        </div>
        
        <div class="form-group">
            <label>Type:</label>
            <select id="${extra.id}_type" onchange="updateExtraType('${extra.id}')">
                <option value="">Select Type...</option>
                <option value="ally" ${extra.type === 'ally' ? 'selected' : ''}>Ally (pets, servants, associates, contacts)</option>
                <option value="domain" ${extra.type === 'domain' ? 'selected' : ''}>Domain (shadow, location, land)</option>
                <option value="item" ${extra.type === 'item' ? 'selected' : ''}>Item (weapon, tool, device)</option>
                <option value="mastery" ${extra.type === 'mastery' ? 'selected' : ''}>Mastery (training, knowledge, natural ability)</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>
                <input type="radio" name="${extra.id}_simple" value="true" ${extra.isSimple ? 'checked' : ''} onchange="updateExtraMode('${extra.id}', true)">
                Simple (Name + Aspect + Invokes)
            </label>
            <label>
                <input type="radio" name="${extra.id}_simple" value="false" ${!extra.isSimple ? 'checked' : ''} onchange="updateExtraMode('${extra.id}', false)">
                Custom (Detailed Features)
            </label>
        </div>
        
        <div id="${extra.id}_simple_options" style="display: ${extra.isSimple ? 'block' : 'none'};">
            <div class="form-group">
                <label>Aspect${extra.simpleAspects && extra.simpleAspects.length > 1 ? 's' : ''}:</label>
                ${aspectsHtml}
                <button type="button" class="add-instance-btn" onclick="addSimpleAspect('${extra.id}')" style="margin-top: 5px; font-size: 0.8em;">Add Aspect</button>
            </div>
            <div class="heritage-info">
                <strong>Simple Extras:</strong> ${getSimpleInvokes(extra.type)} invoke(s) per point spent. Invokes reset at milestones.
            </div>
        </div>
        
        <div id="${extra.id}_custom_options" style="display: ${extra.isSimple ? 'none' : 'block'};">
            ${renderCustomOptions(extra)}
        </div>
        
        <div class="skill-cost">
            <strong>Total Cost: ${calculateExtraCost(extra)} points</strong>
        </div>
    `;
}

function renderExtraDisplayMode(extra) {
    const extraName = extra.name || 'Unnamed Extra';
    const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
    const extraCost = calculateExtraCost(extra);
    const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
    
    let details = '';
    // Build detailed description for the extra
    if (extra.isSimple) {
        // Display one or more aspects for simple extras
        let aspects = [];
        if (extra.simpleAspects && Array.isArray(extra.simpleAspects) && extra.simpleAspects.length > 0) {
            aspects = extra.simpleAspects.filter(a => a && a.trim() !== '');
        } else if (extra.simpleAspect) {
            aspects = [extra.simpleAspect];
        }
        if (aspects.length > 0) {
            if (aspects.length === 1) {
                details = `<div style="margin: 10px 0; color: #cccccc; font-style: italic;">Aspect: ${aspects[0]}</div>`;
            } else {
                details = `<div style="margin: 10px 0; color: #cccccc; font-style: italic;">Aspects: ${aspects.join(', ')}</div>`;
            }
        }
    } else if (!extra.isSimple && extra.features.length > 0) {
        // Build a list of details for each feature instance
        const lines = [];
        extra.features.forEach(feature => {
            const fname = feature.name;
            switch (fname) {
                case 'Training':
                    if (feature.skill) {
                        const lvl = parseInt(feature.level) || 0;
                        if (lvl !== 0) {
                            const skillDisplay = feature.skill
                                .replace(/-/g, ' ')
                                .replace(/\b\w/g, l => l.toUpperCase());
                            lines.push(`Training: +${lvl} to ${skillDisplay}`);
                        }
                    }
                    break;
                case 'Skilled':
                    if (Array.isArray(feature.skillMods) && feature.skillMods.length > 0) {
                        const mods = feature.skillMods.map(sm => {
                            if (!sm.skill || sm.value === undefined || sm.value === null || isNaN(sm.value)) return null;
                            const sname = sm.skill.charAt(0).toUpperCase() + sm.skill.slice(1);
                            return `${sname} (${sm.value >= 0 ? '+' : ''}${sm.value})`;
                        }).filter(Boolean);
                        if (mods.length > 0) {
                            lines.push(`Skilled: ${mods.join(', ')}`);
                        }
                    }
                    break;
                case 'Focus':
                    if (feature.skill) {
                        const sname = feature.skill.charAt(0).toUpperCase() + feature.skill.slice(1);
                        const when = feature.circumstance ? ` when ${feature.circumstance}` : '';
                        lines.push(`Focus: +2 to ${sname}${when}`);
                    }
                    break;
                case 'Flexible':
                    if (feature.skillUsed && feature.skillReplaced) {
                        const used = feature.skillUsed.charAt(0).toUpperCase() + feature.skillUsed.slice(1);
                        const repl = feature.skillReplaced.charAt(0).toUpperCase() + feature.skillReplaced.slice(1);
                        const when = feature.circumstance ? ` when ${feature.circumstance}` : '';
                        lines.push(`Flexible: Use ${used} for ${repl}${when}`);
                    }
                    break;
                case 'Technique':
                    if (feature.ability) {
                        lines.push(`Technique: ${feature.ability}`);
                    }
                    break;
                case 'Talented':
                case 'Unusual':
                case 'Primal Born':
                    if (feature.description) {
                        lines.push(`${fname}: ${feature.description}`);
                    }
                    break;
                case 'Aspect':
                    if (feature.description) {
                        lines.push(`Aspect: ${feature.description}`);
                    }
                    break;
                default:
                    if (feature.description) {
                        lines.push(`${fname}: ${feature.description}`);
                    }
                    break;
            }
        });
        if (lines.length > 0) {
            details = `<div style="margin: 10px 0; color: #cccccc; font-style: italic;">${lines.join('<br>')}</div>`;
        }
    }

    return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0;">${extraName}${extraType}${costText}</h3>
            <div>
                <button type="button" class="export-btn" onclick="editExtra('${extra.id}')" style="font-size: 0.8em; padding: 5px 10px; margin-right: 5px;">Edit</button>
                <button type="button" class="reset-btn" onclick="removeExtra('${extra.id}')" style="font-size: 0.8em; padding: 5px 10px; margin: 0;">Remove</button>
            </div>
        </div>
        ${details}
    `;
}

function editExtra(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    extra.isEditing = true;
    renderExtra(extra);
}

function saveExtra(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    extra.isEditing = false;
    renderExtra(extra);
    updatePointsDisplay();
    saveCharacter();
}

function getSimpleInvokes(type) {
    switch(type) {
        case 'domain': return 2;
        case 'ally':
        case 'item':
        case 'mastery':
        default: return 1;
    }
}

function renderCustomOptions(extra) {
    if (!extra.type) return '<p style="color: #cccccc; font-style: italic;">Select a type to see custom options.</p>';
    
    const features = getAvailableFeatures(extra.type);
    let html = '<h4 style="color: #EFBF04; margin-bottom: 10px;">Available Features:</h4>';
    // Wrap the feature list in a grid container so long lists split into columns.
    html += '<div class="features-grid">';

    features.forEach(feature => {
        const instances = extra.features.filter(f => f.name === feature.name);
        const hasInstances = instances.length > 0;
        const isRequired = feature.required && !extra.features.some(f => f.name === feature.required);
        const disabled = isRequired ? 'disabled' : '';
        const disabledClass = isRequired ? 'disabled' : '';
        
        html += `
            <div class="power-item ${disabledClass}">
                <label>
                    <input type="checkbox" ${hasInstances ? 'checked' : ''} ${disabled} 
                           onchange="toggleExtraFeature('${extra.id}', '${feature.name}', ${feature.cost}, '${feature.required || ''}')">
                    <span class="power-cost">${feature.cost === 0 ? 'Free' : feature.cost < 0 ? `+${Math.abs(feature.cost)}` : feature.cost}</span>
                    ${feature.name}
                </label>
                <div class="power-description">${feature.description}</div>
                
                ${hasInstances ? renderFeatureInstances(extra.id, feature.name, instances) : ''}
            </div>
        `;
    });
    html += '</div>';
    
    return html;
}

function renderFeatureInstances(extraId, featureName, instances) {
    let html = '<div class="feature-instances" style="margin-top: 10px;">';
    
    instances.forEach((instance, index) => {
        html += `
            <div class="feature-instance">
                <div class="feature-instance-header">
                    <span class="feature-instance-title">${featureName} #${index + 1}</span>
                    <button type="button" class="remove-instance-btn" onclick="removeFeatureInstance('${extraId}', '${featureName}', ${index})">×</button>
                </div>
                ${renderFeatureInstanceContent(extraId, featureName, instance, index)}
            </div>
        `;
    });
    
    html += `<button type="button" class="add-instance-btn" onclick="addFeatureInstance('${extraId}', '${featureName}')">Add Another ${featureName}</button>`;
    html += '</div>';
    
    return html;
}

function renderFeatureInstanceContent(extraId, featureName, instance, index) {
    // Build lists of selectable attributes for the various custom features.
    // Base skills always include the core eight stats.
    const baseSkills = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
    // Unique skills are any custom skills added via the Talented feature.  These live in the
    // character.skills object but are not part of the base skill list.  We include them
    // for features that operate on skills.
    const uniqueSkills = Object.keys(character.skills || {}).filter(sk => !baseSkills.includes(sk));
    // Skill options for the "Skilled" feature should include both base and unique skills.
    const skillOptions = [...baseSkills, ...uniqueSkills];
    // Determine advanced powers available for Training.  Advanced powers have ids beginning with "advanced-".
    // Additionally, treat Eidolon Mastery and Umbra Mastery as advanced powers for training purposes.
    const masteryIdsAsAdvanced = ['eidolon-mastery', 'umbra-mastery'];
    const selectedAdvanced = (character.powers || [])
        .filter(p => p.id && (p.id.startsWith('advanced-') || masteryIdsAsAdvanced.includes(p.id)))
        .map(p => p.id);
    // Build option lists for various feature types:
    //   trainingOptions: includes base skills, unique skills, and advanced powers.
    //   skillOnlyOptions: includes base skills and unique skills only.
    const trainingOptions = [...baseSkills, ...uniqueSkills, ...selectedAdvanced];
    const skillOnlyOptions = [...baseSkills, ...uniqueSkills];
    // Helper to build HTML option tags from an array of values, selecting the provided value when matched.
    function buildOptions(optionsArray, selectedValue) {
        return optionsArray.map(opt => {
            const display = opt.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            return `<option value="${opt}" ${selectedValue === opt ? 'selected' : ''}>${display}</option>`;
        }).join('');
    }
    
    switch(featureName) {
        case 'Skilled':
            return `
                <div class="form-group">
                    <label>Skills to Modify:</label>
                    <div>
                        ${(instance.skillMods || []).map((mod, idx) => `
                            <div class="skill-selection" style="margin-bottom: 5px;">
                                <select onchange="updateSkillMod('${extraId}', '${featureName}', ${index}, ${idx}, 'skill', this.value)">
                                    <option value="">Select Skill...</option>
                                    ${skillOptions.map(skill => `<option value="${skill}" ${mod.skill === skill ? 'selected' : ''}>${skill.charAt(0).toUpperCase() + skill.slice(1)}</option>`).join('')}
                                </select>
                                <input type="number" min="-3" max="12" value="${mod.value || 0}" 
                                       onchange="updateSkillMod('${extraId}', '${featureName}', ${index}, ${idx}, 'value', this.value)" placeholder="Value">
                                <button type="button" class="remove-instance-btn" onclick="removeSkillMod('${extraId}', '${featureName}', ${index}, ${idx})">×</button>
                            </div>
                        `).join('')}
                        <button type="button" class="add-instance-btn" onclick="addSkillMod('${extraId}', '${featureName}', ${index})" style="font-size: 0.7em; padding: 3px 6px;">Add Skill</button>
                    </div>
                </div>
            `;
        case 'Flexible':
            return `
                <div class="form-group">
                    <label>Use 
                        <select onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'skillUsed', this.value)" style="display: inline; width: auto; margin: 0 5px;">
                            <option value="">skill</option>
                            ${buildOptions(skillOnlyOptions, instance.skillUsed)}
                        </select> 
                        in place of 
                        <select onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'skillReplaced', this.value)" style="display: inline; width: auto; margin: 0 5px;">
                            <option value="">skill</option>
                            ${buildOptions(skillOnlyOptions, instance.skillReplaced)}
                        </select> 
                        when:
                    </label>
                    <input type="text" placeholder="e.g., researching ancient families" value="${instance.circumstance || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'circumstance', this.value)" style="width: 100%; margin-top: 5px;">
                </div>
            `;
        case 'Focus':
            return `
                <div class="form-group">
                    <label>+2 to 
                        <select onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'skill', this.value)" style="display: inline; width: auto; margin: 0 5px;">
                            <option value="">skill</option>
                            ${buildOptions(skillOnlyOptions, instance.skill)}
                        </select> 
                        when:
                    </label>
                    <input type="text" placeholder="e.g., fighting in your home domain" value="${instance.circumstance || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'circumstance', this.value)" style="width: 100%; margin-top: 5px;">
                </div>
            `;
        case 'Technique':
            return `
                <div class="form-group">
                    <label>Power Ability:</label>
                    <input type="text" placeholder="e.g., Trump Defense from Trump Artist" value="${instance.ability || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'ability', this.value)" style="width: 100%;">
                </div>
            `;
        case 'Training':
            return `
                <div class="form-group">
                    <label>Skill to Improve:</label>
                    <select onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'skill', this.value)" style="width: 100%;">
                        <option value="">Select Skill or Power...</option>
                        ${buildOptions(trainingOptions, instance.skill)}
                    </select>
                    <label style="margin-top: 10px;">Improvement Level (+1 per point):</label>
                    <!-- Allow training improvements beyond five ranks.  Remove the max attribute so GMs and players can choose higher values if desired. -->
                    <input type="number" min="1" value="${instance.level || 1}" 
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'level', this.value)" style="width: 100%;">
                </div>
            `;
        case 'Talented':
        case 'Unusual':
        case 'Primal Born':
            return `
                <div class="form-group">
                    <label>Description:</label>
                    <textarea placeholder="Describe the custom ability..." 
                              onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'description', this.value)"
                              style="width: 100%; height: 60px; resize: vertical;">${instance.description || ''}</textarea>
                    <label style="margin-top: 10px;">GM-determined Cost:</label>
                    <input type="number" placeholder="Points" value="${instance.manualCost || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'manualCost', this.value)" style="width: 100%;">
                </div>
            `;
        default:
            return `
                <div class="form-group">
                    <label>Notes:</label>
                    <input type="text" placeholder="Additional details..." value="${instance.description || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'description', this.value)" style="width: 100%;">
                </div>
            `;
    }
}

function updateFeatureData(extraId, featureName, instanceIndex, field, value) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (instance) {
        instance[field] = field === 'level' || field === 'manualCost' ? parseInt(value) || 0 : value;
        updatePointsDisplay();
        saveCharacter();
    }
}

function addSkillMod(extraId, featureName, instanceIndex) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (!instance.skillMods) instance.skillMods = [];
    instance.skillMods.push({ skill: '', value: 0 });
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    saveCharacter();
}

function removeSkillMod(extraId, featureName, instanceIndex, skillIndex) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    instance.skillMods.splice(skillIndex, 1);
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    saveCharacter();
}

function updateSkillMod(extraId, featureName, instanceIndex, skillIndex, field, value) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (!instance.skillMods) instance.skillMods = [];
    if (!instance.skillMods[skillIndex]) instance.skillMods[skillIndex] = {};
    
    instance.skillMods[skillIndex][field] = field === 'value' ? parseInt(value) : value;
    updatePointsDisplay();
    saveCharacter();
}

function addFeatureInstance(extraId, featureName) {
    const extra = character.extras.find(e => e.id === extraId);
    const feature = getAvailableFeatures(extra.type).find(f => f.name === featureName);
    
    const newInstance = {
        name: featureName,
        cost: feature.cost,
        instanceIndex: featureInstanceCounter++
    };
    
    // Initialize specific data based on feature type
    switch(featureName) {
        case 'Skilled':
            newInstance.skillMods = [];
            break;
        case 'Training':
            newInstance.skill = '';
            newInstance.level = 1;
            break;
        case 'Flexible':
            newInstance.skillUsed = '';
            newInstance.skillReplaced = '';
            newInstance.circumstance = '';
            break;
        case 'Focus':
            newInstance.skill = '';
            newInstance.circumstance = '';
            break;
        case 'Technique':
            newInstance.ability = '';
            break;
        case 'Talented':
        case 'Unusual':
        case 'Primal Born':
            newInstance.description = '';
            newInstance.manualCost = 0;
            break;
        default:
            newInstance.description = '';
            break;
    }
    
    extra.features.push(newInstance);
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    
    updatePointsDisplay();
    saveCharacter();
}

function removeFeatureInstance(extraId, featureName, instanceIndex) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    
    if (instances.length > 0) {
        const indexToRemove = extra.features.findIndex(f => f.name === featureName && instances.indexOf(f) === instanceIndex);
        if (indexToRemove >= 0) {
            extra.features.splice(indexToRemove, 1);
        }
        
        const remainingInstances = extra.features.filter(f => f.name === featureName);
        if (remainingInstances.length === 0) {
            const checkbox = document.querySelector(`#${extraId}_custom_options input[onchange*="${featureName}"]`);
            if (checkbox) checkbox.checked = false;
        }
        
        const customDiv = document.getElementById(extraId + '_custom_options');
        customDiv.innerHTML = renderCustomOptions(extra);
        
        updatePointsDisplay();
        saveCharacter();
    }
}

function toggleExtraFeature(extraId, featureName, cost, required) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    
    if (instances.length > 0) {
        // Remove all instances of this feature
        extra.features = extra.features.filter(f => f.name !== featureName);
    } else {
        // Add first instance of this feature
        addFeatureInstance(extraId, featureName);
        return; // addFeatureInstance already handles the re-render
    }
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    
    updatePointsDisplay();
    saveCharacter();
}

function getAvailableFeatures(type) {
    const features = {
        ally: [
            { name: 'Base Cost', cost: 0.5, required: '', description: 'REQUIRED FIRST. Ally starts with an Aspect, one Skill at Amber (0), another at Chaos (-1), and 2 mild stress boxes.' },
            { name: 'Organization', cost: 1, required: 'Base Cost', description: 'Has many members. Ability to affect things at scale. Start with one face (named member).' },
            { name: 'Aspect', cost: 0.5, required: 'Base Cost', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.' },
            { name: 'Bound', cost: 1, required: 'Base Cost', description: 'May use Ally\'s senses, Skills, or Powers (w/ concentration).' },
            { name: 'Resolute', cost: 0.25, required: 'Base Cost', description: 'Gives Ally +1 to psychic defense.' },
            { name: 'Skilled', cost: 0.5, required: 'Base Cost', description: 'Additional Amber and Chaos skill plus 3 points to buy Skills, Powers, etc.' },
            { name: 'Sturdy', cost: 0.25, required: 'Base Cost', description: 'Add one mild stress box. If bought thrice, may add moderate boxes.' },
            { name: 'Unusual', cost: 0, required: 'Base Cost', description: 'Add a Feature not covered above (see GM for cost).' },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: 'Base Cost', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back.' }
        ],
        domain: [
            { name: 'Aspect', cost: 0.25, required: '', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.' },
            { name: 'Barrier', cost: 0.25, required: '', description: 'Each time purchased blocks one Power from Domain.' },
            { name: 'Control', cost: 0.25, required: '', description: 'Each time purchased gives +1 to control Domain.' },
            { name: 'Exceptional', cost: 0.5, required: '', description: 'Once per session, break the rules. May repeat by spending Good Stuff with GM approval.' },
            { name: 'Flexible', cost: 0.5, required: '', description: 'Use one Skill in place of another when [describe circumstance].' },
            { name: 'Focus', cost: 0.5, required: '', description: '+2 to a Skill when [describe circumstance].' },
            { name: 'Security', cost: 0.25, required: '', description: 'Each purchase gives +1 to secure Domain.' },
            { name: 'Unusual', cost: 0, required: '', description: 'Add a Feature not covered above (see GM for cost).' },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: '', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back.' }
        ],
        item: [
            { name: 'Aspect', cost: 0.5, required: '', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.' },
            { name: 'Exceptional', cost: 1, required: '', description: 'Once per session, break the rules. May repeat by spending Good Stuff with GM approval.' },
            { name: 'Flexible', cost: 0.5, required: '', description: 'Use one Skill in place of another when [describe circumstance].' },
            { name: 'Focus', cost: 1, required: '', description: '+2 to a Skill when [describe circumstance].' },
            { name: 'Harmful', cost: 0.5, required: '', description: 'Do additional shift of harm for damage type or with Skill/Power if attack succeeds.' },
            { name: 'Protective', cost: 1, required: '', description: 'Reduces successful attack by one shift for damage type. If reduced to <1, attacker gets boost.' },
            { name: 'Unusual', cost: 0, required: '', description: 'Add a Feature not covered above (see GM for cost).' },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: '', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back.' }
        ],
        mastery: [
            { name: 'Aspect', cost: 0.5, required: '', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.' },
            { name: 'Dominant', cost: 4, required: '', description: 'Increases the Scale of one Skill to Legendary. Only one Skill allowed.' },
            { name: 'Exceptional', cost: 1, required: '', description: 'Once per session, break the rules. May repeat by spending Good Stuff with GM approval.' },
            { name: 'Flexible', cost: 0.5, required: '', description: 'Use one Skill in place of another when [describe circumstance].' },
            { name: 'Focus', cost: 1, required: '', description: '+2 to a Skill when [describe circumstance].' },
            { name: 'Harmful', cost: 0.5, required: '', description: 'Do additional shift of harm for damage type or with Skill/Power if attack succeeds.' },
            { name: 'Immortal', cost: 1, required: '', description: 'Will recover from most any damage over time.' },
            { name: 'Incandescent', cost: 1, required: '', description: 'Lose all Power initiations, immune to Unmaking.' },
            { name: 'Primal Born', cost: 0, required: '', description: 'Requires Incandescent and Immortal, activated Ancient Heritage (see GM for cost and effects).' },
            { name: 'Protective', cost: 1, required: '', description: 'Reduces successful attack by one shift for damage type. If reduced to <1, attacker gets boost.' },
            { name: 'Talented', cost: 0, required: '', description: 'Design a unique skill with custom abilities (see GM for cost).' },
            { name: 'Technique', cost: 0.5, required: '', description: 'Add one ability from a Power. If full Power acquired later, this refunds back.' },
            { name: 'Training', cost: 1, required: '', description: '1 point per +1 to Skill. Improve Advanced Power or Unique Skill.' },
            { name: 'Unusual', cost: 0, required: '', description: 'Add a Feature not covered above (see GM for cost).' },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: '', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back.' }
        ]
    };
    
    return features[type] || [];
}

function updateExtraName(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    const nameInput = document.getElementById(extraId + '_name');
    extra.name = nameInput.value;
    
    const header = document.querySelector(`#${extraId} h3`);
    header.textContent = `Extra: ${extra.name || 'Unnamed'}`;
    
    saveCharacter();
}

function updateExtraType(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    const typeSelect = document.getElementById(extraId + '_type');
    extra.type = typeSelect.value;
    extra.features = [];
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    
    const simpleDiv = document.getElementById(extraId + '_simple_options');
    const heritageInfo = simpleDiv.querySelector('.heritage-info');
    heritageInfo.innerHTML = `<strong>Simple Extras:</strong> ${getSimpleInvokes(extra.type)} invoke(s) per point spent. Invokes reset at milestones.`;
    
    updatePointsDisplay();
    saveCharacter();
}

function updateExtraMode(extraId, isSimple) {
    const extra = character.extras.find(e => e.id === extraId);
    extra.isSimple = isSimple;
    
    document.getElementById(extraId + '_simple_options').style.display = isSimple ? 'block' : 'none';
    document.getElementById(extraId + '_custom_options').style.display = isSimple ? 'none' : 'block';
    
    updatePointsDisplay();
    saveCharacter();
}

// Update a specific simple aspect.  The index parameter identifies which
// aspect is being edited.  If undefined, defaults to index 0 to support
// backwards compatibility with single-aspect extras.
function updateExtraAspect(extraId, index = 0) {
    const extra = character.extras.find(e => e.id === extraId);
    // Ensure the simpleAspects array exists
    if (!extra.simpleAspects || !Array.isArray(extra.simpleAspects)) {
        extra.simpleAspects = [];
    }
    const input = document.getElementById(`${extraId}_aspect_${index}`);
    if (input) {
        extra.simpleAspects[index] = input.value;
    }
    // Maintain legacy simpleAspect for backward compatibility
    extra.simpleAspect = extra.simpleAspects[0] || '';
    updatePointsDisplay();
    saveCharacter();
}

// Add a new empty aspect to a simple extra.  Additional aspects cost
// 1 point each beyond the first.
function addSimpleAspect(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra.simpleAspects || !Array.isArray(extra.simpleAspects)) {
        extra.simpleAspects = [extra.simpleAspect || ''];
    }
    extra.simpleAspects.push('');
    renderExtra(extra);
    updatePointsDisplay();
    saveCharacter();
}

// Remove an aspect by index.  Do not remove the last remaining aspect.
function removeSimpleAspect(extraId, index) {
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra.simpleAspects || extra.simpleAspects.length <= 1) {
        return;
    }
    extra.simpleAspects.splice(index, 1);
    // Update legacy simpleAspect
    extra.simpleAspect = extra.simpleAspects[0] || '';
    renderExtra(extra);
    updatePointsDisplay();
    saveCharacter();
}

function calculateExtraCost(extra) {
    if (!extra.type) return 0;
    
    if (extra.isSimple) {
        // Simple extras cost 1 point for the first aspect and 1 point for each
        // additional aspect beyond the first.  If no aspects are defined,
        // default to a cost of 1.
        if (extra.simpleAspects && Array.isArray(extra.simpleAspects)) {
            return Math.max(1, extra.simpleAspects.length);
        }
        return 1;
    } else {
        return extra.features.reduce((total, feature) => {
            let featureCost = feature.cost;
            
            // Handle special cases
            if (feature.name === 'Training' && feature.level) {
                featureCost = feature.level; // 1 point per +1
            } else if ((feature.name === 'Talented' || feature.name === 'Unusual' || feature.name === 'Primal Born') && feature.manualCost !== undefined) {
                featureCost = feature.manualCost; // GM-determined cost
            }
            
            return total + featureCost;
        }, 0);
    }
}

// Points calculation
function calculateUsedPoints() {
    let total = 0;
    
    // Add heritage points (can be negative)
    total += character.heritagePoints;
    
    // Calculate skill costs
    Object.values(character.skills).forEach(value => {
        total += Math.max(0, value);
    });
    
    // Calculate power costs with heritage discounts and credits
    character.powers.forEach(power => {
        let powerCost = power.cost;
        // Apply heritage discounts first
        if (isHeritageFreePower(power.id)) {
            powerCost = 0;
        } else {
            // Apply credits only if power wasn't free from heritage
            if (power.credit) {
                const credits = power.credit.split(',');
                credits.forEach(credit => {
                    const [powerName, creditValue] = credit.split(':');
                    const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                    if (hasPowerForCredit) {
                        powerCost += parseInt(creditValue);
                    }
                });
            }
        }
        total += Math.max(0, powerCost);
    });

    // Heritage free power credit: If a heritage provides a free power but the player opts out (unchecked),
    // award the base cost as credit back to the point pool.  Recognized Amber provides Pattern Adept (cost 5),
    // Chaos provides Shapeshifting (cost 3), and Both provides both.  If the relevant power is not selected,
    // apply a negative cost (credit) equal to its normal cost.
    let freeCredit = 0;
    if (character.heritage === 'recognized-amber' || character.heritage === 'both') {
        const hasPattern = character.powers.some(p => p.id === 'pattern-adept');
        if (!hasPattern) {
            freeCredit -= 5;
        }
    }
    if (character.heritage === 'chaos' || character.heritage === 'both') {
        const hasShapeshifting = character.powers.some(p => p.id === 'shapeshifting');
        if (!hasShapeshifting) {
            freeCredit -= 3;
        }
    }
    total += freeCredit;
    
    // Calculate extras costs
    character.extras.forEach(extra => {
        total += calculateExtraCost(extra);
    });
    
    return total;
}

/**
 * Aggregate skill modifiers granted by Extras.  Certain custom features on
 * Extras allow players to modify a skill’s base rating.  For example, the
 * “Skilled” feature supports arbitrary skill modifiers via the skillMods
 * array and “Training” provides a +1 per level to a single skill.  This
 * helper walks through all extras and collects these modifications keyed
 * by skill name.  The returned object has the shape
 *   {
 *     skillName: [ { extraName: string, featureName: string, value: number }, ... ],
 *     ...
 *   }
 * Only modifiers with a numeric value are returned; other feature types
 * provide situational bonuses and are represented in the extras detail
 * section instead of here.
 */
function getSkillModifiers() {
    const modifiers = {};
    character.extras.forEach(extra => {
        // Only complex extras can modify skills; simple extras just have an aspect
        if (!extra.isSimple && extra.features && extra.features.length > 0) {
            extra.features.forEach(feature => {
                const featureName = feature.name;
                // Skilled feature: arbitrary skill modifications
                if (featureName === 'Skilled' && Array.isArray(feature.skillMods)) {
                    feature.skillMods.forEach(mod => {
                        // Skip incomplete entries
                        if (!mod.skill || mod.value === undefined || mod.value === null || isNaN(mod.value)) return;
                        const skill = mod.skill;
                        const value = parseInt(mod.value);
                        if (!modifiers[skill]) modifiers[skill] = [];
                        modifiers[skill].push({ extraName: extra.name || 'Extra', featureName: featureName, value: value });
                    });
                }
                // Training feature: +level to specified skill
                if (featureName === 'Training' && feature.skill) {
                    const skill = feature.skill;
                    const level = parseInt(feature.level) || 0;
                    if (level !== 0) {
                        if (!modifiers[skill]) modifiers[skill] = [];
                        modifiers[skill].push({ extraName: extra.name || 'Extra', featureName: featureName, value: level });
                    }
                }
            });
        }
    });
    return modifiers;
}
function updatePointsDisplay() {
    character.usedPoints = calculateUsedPoints();
    const remaining = character.totalPoints - character.usedPoints;
    
    document.getElementById('pointsRemaining').textContent = remaining;
    
    const statusDiv = document.getElementById('pointsStatus');
    if (remaining < 0) {
        statusDiv.innerHTML = '<div class="points-warning">Over Budget!</div>';
        document.getElementById('pointsRemaining').className = 'points-remaining points-warning';
    } else if (remaining === 0) {
        statusDiv.innerHTML = '<div class="success">Perfect!</div>';
        document.getElementById('pointsRemaining').className = 'points-remaining';
    } else {
        statusDiv.innerHTML = '';
        document.getElementById('pointsRemaining').className = 'points-remaining';
    }
    
    updateCharacterSummary();
}

function updateCharacterSummary() {
  const summaryEl = document.getElementById('characterSummary');
  if (!summaryEl) return;

  // Helpers
  const heritageCost = Math.abs(character.heritagePoints || 0);

  // Skills: 1 point per rank above 0
  const skillsCost = Object.values(character.skills || {}).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);

  // Powers: compute net cost, honoring free-from-heritage and credits.
  function isHeritageFreePower(id) {
    const h = character.heritage;
    if (h === 'recognized-amber' || h === 'both') {
      if (id === 'pattern-adept') return true;
    }
    if (h === 'chaos' || h === 'both') {
      if (id === 'shapeshifting') return true;
    }
    return false;
  }
  function hasPower(id) {
    return (character.powers || []).some(p => p.id === id);
  }

  // Credit helpers (kept narrow & explicit; extend if you add more)
  function powerNetCost(p) {
    // Free by heritage?
    if (isHeritageFreePower(p.id)) return 0;

    // Base cost
    let cost = Number(p.cost || 0);

    // Known credits
    // Warden of the Grand Stair: -1 if Pattern Adept
    if (p.id === 'grand-stair-warden' && hasPower('pattern-adept')) cost -= 1;

    // Advanced Shapeshifting: -3 if Shapeshifting
    if (p.id === 'advanced-shapeshifting' && hasPower('shapeshifting')) cost -= 3;

    // Umbra Mastery: -2 if Shapeshifting
    if (p.id === 'umbra-mastery' && hasPower('shapeshifting')) cost -= 2;

    // (Add further credits here if your rules expand)

    return Math.max(cost, 0);
  }

  const powersCost = (character.powers || []).reduce((sum, p) => sum + powerNetCost(p), 0);

  // Extras: use existing calculator
  const extrasCost = (character.extras || []).reduce((sum, ex) => sum + calculateExtraCost(ex), 0);

  const totalUsed = heritageCost + skillsCost + powersCost + extrasCost;
  const goodStuff = (character.totalPoints || 60) - totalUsed;

  // Render
  let html = '';
  html += '<div class="summary-section">';
  html += '<h4>Point Allocation</h4>';
  html += '<ul class="summary-list">';
  html += `<li>Total Available: ${character.totalPoints || 60}</li>`;
  html += `<li>Heritage Cost: ${heritageCost}</li>`;
  html += `<li>Skills: ${skillsCost}</li>`;
  html += `<li>Powers: ${powersCost}</li>`;
  html += `<li>Extras: ${extrasCost}</li>`;
  html += `<li><strong>Total Used: ${totalUsed}</strong></li>`;
  html += `<li><strong>Good Stuff: ${goodStuff}</strong></li>`;
  html += '</ul></div>';

  // (Keep your existing sections below — Aspects, Skills grid w/ modifiers, Extras snapshot, etc.)
  summaryEl.innerHTML = html + summaryEl.innerHTML.replace(/^[\s\S]*?<div class="summary-section">/,'<div class="summary-section">');
}


// Save/Load functionality
function saveCharacter() {
    try {
        // Persist current names into character state
        const charNameEl = document.getElementById('characterName');
        const playerNameEl = document.getElementById('playerName');
        if (charNameEl) character.characterName = charNameEl.value;
        if (playerNameEl) character.playerName = playerNameEl.value;
        
        // Guard against accidental loss of extras.  If extras suddenly
        // become empty but we have a previously saved list of extras,
        // restore them from lastGoodExtras.  Conversely, whenever
        // extras are non-empty, update lastGoodExtras with a deep copy
        // of the current extras so we always have a fallback.
        if (!character.extras || character.extras.length === 0) {
            if (Array.isArray(lastGoodExtras) && lastGoodExtras.length > 0) {
                // Deep clone to avoid sharing object references
                character.extras = JSON.parse(JSON.stringify(lastGoodExtras));
            }
        } else {
            // Update lastGoodExtras to reflect the current extras state
            try {
                lastGoodExtras = JSON.parse(JSON.stringify(character.extras));
            } catch (e) {
                // If cloning fails for any reason, fall back to a shallow copy
                lastGoodExtras = character.extras.slice();
            }
        }

        const saveData = {
            ...character,
            concept: document.getElementById('concept').value,
            position: document.getElementById('position').value,
            trouble: document.getElementById('trouble').value,
            secret: document.getElementById('secret').value,
            gmPowerCosts: gmPowerCosts,
            formValues: {
                heritage: document.getElementById('heritage').value,
                skills: {},
                powers: {}
            },
            extraIdCounter: extraIdCounter,
            featureInstanceCounter: featureInstanceCounter
        };
        
        // Include names directly in saveData for easy retrieval
        saveData.characterName = character.characterName;
        saveData.playerName = character.playerName;
        
        const skills = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
        skills.forEach(skill => {
            saveData.formValues.skills[skill] = document.getElementById(skill).value;
        });
        
        const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
        powerElements.forEach(element => {
            saveData.formValues.powers[element.id] = element.checked;
        });
        
        localStorage.setItem('amberCharacter', JSON.stringify(saveData));

        // Also keep a rolling backup of the last successfully saved character in case something
        // goes wrong and the extras array or other data gets wiped.  This allows us to
        // restore from backup on the next load if extras disappear.
        try {
            localStorage.setItem('amberCharacterBackup', JSON.stringify(saveData));
        } catch (e) {
            // ignore backup errors silently
        }

        // --- Multi-character persistence ---
        // Ensure the savedCharacters list is initialized
        if (!Array.isArray(savedCharacters) || savedCharacters.length === 0) {
            try {
                savedCharacters = JSON.parse(localStorage.getItem('amberCharacters')) || [];
            } catch (e) {
                savedCharacters = [];
            }
        }
        // Determine currentCharacterId; if not set, generate one
        if (!currentCharacterId) {
            const storedId = localStorage.getItem('amberCurrentCharacterId');
            currentCharacterId = storedId || Date.now().toString();
            localStorage.setItem('amberCurrentCharacterId', currentCharacterId);
        }
        // Update or insert this character into the list
        let found = false;
        for (let i = 0; i < savedCharacters.length; i++) {
            if (savedCharacters[i].id === currentCharacterId) {
                savedCharacters[i].data = saveData;
                found = true;
                break;
            }
        }
        if (!found) {
            savedCharacters.push({ id: currentCharacterId, data: saveData });
        }
        // Persist the list
        localStorage.setItem('amberCharacters', JSON.stringify(savedCharacters));
        // Update the character select dropdown if it exists
        if (typeof populateCharacterSelect === 'function') {
            populateCharacterSelect();
        }
        // Display save status
        document.getElementById('saveStatus').textContent = 'Saved ✓';
        setTimeout(() => {
            document.getElementById('saveStatus').textContent = '';
        }, 2000);
    } catch (error) {
        console.error('Save failed:', error);
        document.getElementById('saveStatus').textContent = 'Save failed!';
    }
}

// ======================= Multi-Character Support =======================

// Load the list of saved characters from localStorage. Returns an array.
function loadSavedCharacters() {
    try {
        // Attempt to load the multi-character list.  If it exists and parses, return it.
        const data = localStorage.getItem('amberCharacters');
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                // If parsing fails, fall through to legacy checks
            }
        }
        // Fallback: if a legacy single-character save exists, wrap it into a saved list.  This
        // ensures users upgrading from earlier versions still see their saved character.
        const single = localStorage.getItem('amberCharacter');
        if (single) {
            try {
                const singleData = JSON.parse(single);
                // Use a consistent ID so that subsequent saves update the same entry.
                const legacyId = localStorage.getItem('amberCurrentCharacterId') || Date.now().toString();
                // Persist this id for future use
                localStorage.setItem('amberCurrentCharacterId', legacyId);
                return [{ id: legacyId, data: singleData }];
            } catch (e) {
                return [];
            }
        }
        return [];
    } catch (e) {
        return [];
    }
}

// Save the current list of saved characters back to localStorage
function saveSavedCharacters() {
    localStorage.setItem('amberCharacters', JSON.stringify(savedCharacters));
}

// Populate the character selection dropdown with the list of saved characters
function populateCharacterSelect() {
    const select = document.getElementById('characterSelect');
    if (!select) return;
    // Clear existing options
    select.innerHTML = '';
    savedCharacters.forEach(entry => {
        const opt = document.createElement('option');
        // Determine display name
        let name = 'Unnamed Character';
        if (entry.data) {
            const cName = entry.data.characterName || '';
            const pName = entry.data.playerName || '';
            name = cName || 'Unnamed Character';
        }
        opt.value = entry.id;
        opt.textContent = name;
        select.appendChild(opt);
    });
    if (currentCharacterId) {
        select.value = currentCharacterId;
    }
}

// Load a character from provided data and update the UI
function loadCharacterData(data) {
    // Store to localStorage under the single-character key for compatibility
    localStorage.setItem('amberCharacter', JSON.stringify(data));
    // Use existing loader to populate the UI
    loadCharacter();
    updatePointsDisplay();
}

// Reset UI and internal character state to defaults without deleting saved characters
function resetCharacterData() {
    // Reset the global character object
    character = {
        characterName: '',
        playerName: '',
        heritage: '',
        concept: '',
        position: '',
        trouble: '',
        secret: '',
        skills: {
            strength: 0,
            warfare: 0,
            psyche: 0,
            endurance: 0,
            status: 0,
            intrigue: 0,
            hunting: 0,
            lore: 0
        },
        powers: [],
        extras: [],
        totalPoints: 60,
        usedPoints: 0,
        heritagePoints: 0
    };
    gmPowerCosts = {};
    extraIdCounter = 0;
    featureInstanceCounter = 0;
    // Clear character info fields
    ['characterName','playerName','concept','position','trouble','secret'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    // Reset heritage
    const heritageEl = document.getElementById('heritage');
    if (heritageEl) heritageEl.value = '';
    updateHeritage();
    // Reset skills
    ['strength','warfare','psyche','endurance','status','intrigue','hunting','lore'].forEach(skill => {
        const el = document.getElementById(skill);
        if (el) el.value = '0';
    });
    updateSkills();
    // Reset powers
    document.querySelectorAll('input[type="checkbox"][data-cost]').forEach(el => {
        el.checked = false;
        el.disabled = false;
    });
    updatePowers();
    // Clear extras UI
    const extrasContainer = document.getElementById('extrasContainer');
    if (extrasContainer) extrasContainer.innerHTML = '';
    // Update summary
    updateCharacterSummary();
}

// Create a brand-new character instance and switch to it
function createNewCharacter() {
    if (!confirm('Create a new character? Current character will be saved.')) return;
    // Save current character state before switching
    saveCharacter();
    // Generate a new unique ID for the fresh character
    currentCharacterId = Date.now().toString();
    localStorage.setItem('amberCurrentCharacterId', currentCharacterId);
    // Reset the UI and internal state to defaults
    resetCharacterData();
    // Save the blank character to the saved list
    saveCharacter();
    // Repopulate the dropdown and select the new entry
    populateCharacterSelect();
    const selectEl = document.getElementById('characterSelect');
    if (selectEl) selectEl.value = currentCharacterId;
}

// Handle selection change in the character dropdown
function selectCharacter() {
    const selectEl = document.getElementById('characterSelect');
    if (!selectEl) return;
    const newId = selectEl.value;
    if (!newId || newId === currentCharacterId) return;
    // Save current char before switching
    saveCharacter();
    currentCharacterId = newId;
    localStorage.setItem('amberCurrentCharacterId', currentCharacterId);
    const entry = savedCharacters.find(c => c.id === currentCharacterId);
    if (entry && entry.data) {
        loadCharacterData(entry.data);
    } else {
        // If no data found, reset to defaults
        resetCharacterData();
    }
}

// Export current character to a JSON file
function exportCharacterJson() {
    saveCharacter();
    const entry = savedCharacters.find(c => c.id === currentCharacterId);
    if (!entry || !entry.data) {
        alert('No character data to export.');
        return;
    }
    const data = entry.data;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const charName = data.characterName || 'Character';
    const playerName = data.playerName ? ' (' + data.playerName + ')' : '';
    const filename = `Ancient Secrets - ${charName}${playerName}.json`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Trigger hidden file input for import
function triggerImportCharacter() {
    const fileInput = document.getElementById('importFile');
    if (fileInput) fileInput.click();
}

// Import a character from a JSON file selected via the hidden file input
function importCharacter(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data || typeof data !== 'object') throw new Error();
            // Assign a new ID for imported character
            const newId = Date.now().toString();
            savedCharacters.push({ id: newId, data });
            saveSavedCharacters();
            currentCharacterId = newId;
            localStorage.setItem('amberCurrentCharacterId', currentCharacterId);
            populateCharacterSelect();
            const selectEl = document.getElementById('characterSelect');
            if (selectEl) selectEl.value = currentCharacterId;
            loadCharacterData(data);
            alert('Character imported successfully.');
        } catch (error) {
            alert('Failed to import character: invalid JSON file.');
        }
        // Reset file input value to allow importing the same file again if needed
        event.target.value = '';
    };
    reader.readAsText(file);
}

// Delete the currently selected character.  This removes the character
// entry from the multi-character list and clears associated data from
// localStorage.  After deletion, if other characters remain, the first
// one is loaded; otherwise a new blank character is created.
function deleteCharacter() {
    if (!confirm('Delete this character? This cannot be undone.')) return;
    // Save current state before deleting (to ensure any unsaved edits are
    // preserved in another character).  This also updates backup.
    saveCharacter();
    // Remove from savedCharacters list
    savedCharacters = savedCharacters.filter(entry => entry.id !== currentCharacterId);
    // Persist updated list
    saveSavedCharacters();
    // Remove single-character save
    localStorage.removeItem('amberCharacter');
    localStorage.removeItem('amberCharacterBackup');
    // Choose next character to load
    if (savedCharacters.length > 0) {
        currentCharacterId = savedCharacters[0].id;
        localStorage.setItem('amberCurrentCharacterId', currentCharacterId);
        loadCharacterData(savedCharacters[0].data);
    } else {
        // Create a new blank character entry
        currentCharacterId = Date.now().toString();
        localStorage.setItem('amberCurrentCharacterId', currentCharacterId);
        resetCharacterData();
        // Save the blank character into the list so it shows up in the selector
        saveCharacter();
    }
    // Update dropdown to reflect removal
    populateCharacterSelect();
    const selectEl = document.getElementById('characterSelect');
    if (selectEl) selectEl.value = currentCharacterId;
}

function loadCharacter() {
    try {
        const saved = localStorage.getItem('amberCharacter');
        if (!saved) return;
        
        let saveData = JSON.parse(saved);

        /*
         * If extras are unexpectedly missing from the saved data, attempt to
         * restore them from the last known good backup.  We observed cases
         * where the extras array was blanked out in localStorage, leaving
         * users without their custom extras.  To mitigate this, we keep
         * a rolling backup (amberCharacterBackup) whenever saveCharacter()
         * is called.  Here we inspect the backup and, if it contains
         * extras, merge them back into the current save.  This only
         * executes when the loaded save has no extras; it preserves
         * intentional removal of extras.
         */
        try {
            if (!saveData.extras || saveData.extras.length === 0) {
                const backupRaw = localStorage.getItem('amberCharacterBackup');
                if (backupRaw) {
                    const backupData = JSON.parse(backupRaw);
                    if (backupData && Array.isArray(backupData.extras) && backupData.extras.length > 0) {
                        // Restore extras and counters from backup
                        saveData.extras = backupData.extras;
                        saveData.extraIdCounter = backupData.extraIdCounter || saveData.extraIdCounter;
                        saveData.featureInstanceCounter = backupData.featureInstanceCounter || saveData.featureInstanceCounter;
                        // Persist the restored data so subsequent loads retain extras
                        localStorage.setItem('amberCharacter', JSON.stringify(saveData));
                    }
                }
            }
        } catch (err) {
            console.warn('Failed to restore extras from backup:', err);
        }
        
        // Restore names
        if (saveData.characterName && document.getElementById('characterName')) {
            document.getElementById('characterName').value = saveData.characterName;
            character.characterName = saveData.characterName;
        }
        if (saveData.playerName && document.getElementById('playerName')) {
            document.getElementById('playerName').value = saveData.playerName;
            character.playerName = saveData.playerName;
        }
        
        if (saveData.concept) document.getElementById('concept').value = saveData.concept;
        if (saveData.position) document.getElementById('position').value = saveData.position;
        if (saveData.trouble) document.getElementById('trouble').value = saveData.trouble;
        if (saveData.secret) document.getElementById('secret').value = saveData.secret;
        
        if (saveData.gmPowerCosts) {
            gmPowerCosts = saveData.gmPowerCosts;
            // Restore GM power cost inputs
            Object.entries(gmPowerCosts).forEach(([powerId, cost]) => {
                const input = document.getElementById(powerId + '-manual-cost');
                if (input) input.value = cost;
            });
        }
        
        if (saveData.formValues && saveData.formValues.heritage) {
            document.getElementById('heritage').value = saveData.formValues.heritage;
            updateHeritage();
        }
        
        if (saveData.formValues && saveData.formValues.skills) {
            Object.entries(saveData.formValues.skills).forEach(([skill, value]) => {
                if (document.getElementById(skill)) {
                    document.getElementById(skill).value = value;
                }
            });
            updateSkills();
        }
        
        if (saveData.formValues && saveData.formValues.powers) {
            Object.entries(saveData.formValues.powers).forEach(([powerId, checked]) => {
                const element = document.getElementById(powerId);
                if (element) {
                    element.checked = checked;
                }
            });
            updatePowers();
        }
        
        if (saveData.extras) {
            character.extras = saveData.extras;
            extraIdCounter = saveData.extraIdCounter || 0;
            featureInstanceCounter = saveData.featureInstanceCounter || 0;

            // Normalize older extras to ensure multiple simple aspects are supported
            character.extras.forEach(extra => {
                if (extra.isSimple) {
                    // If the new simpleAspects array is missing, derive it from the legacy simpleAspect field
                    if (!extra.simpleAspects || !Array.isArray(extra.simpleAspects)) {
                        if (extra.simpleAspect && extra.simpleAspect.trim() !== '') {
                            extra.simpleAspects = [extra.simpleAspect];
                        } else {
                            extra.simpleAspects = [''];
                        }
                    }
                }
            });
            
            document.getElementById('extrasContainer').innerHTML = '';
            
            character.extras.forEach(extra => {
                renderExtra(extra);
            });
        }
        
        document.getElementById('saveStatus').textContent = 'Loaded previous save ✓';
        setTimeout(() => {
            document.getElementById('saveStatus').textContent = '';
        }, 3000);
    } catch (error) {
        console.error('Load failed:', error);
        document.getElementById('saveStatus').textContent = 'Load failed!';
    }
}

function resetCharacter() {
    if (confirm('Are you sure you want to reset all character data? This cannot be undone.')) {
        localStorage.removeItem('amberCharacter');
        location.reload();
    }
}

function exportCharacter() {
    // Ensure names are up to date in character state
    if (document.getElementById('characterName')) character.characterName = document.getElementById('characterName').value;
    if (document.getElementById('playerName')) character.playerName = document.getElementById('playerName').value;
    
    const exportData = {
        ...character,
        concept: document.getElementById('concept').value,
        position: document.getElementById('position').value,
        trouble: document.getElementById('trouble').value,
        secret: document.getElementById('secret').value
    };
    
    let output = '=== ANCIENT SECRETS CHARACTER SHEET ===\n\n';
    output += `Character Name: ${exportData.characterName || ''}\n`;
    output += `Player Name: ${exportData.playerName || ''}\n`;
    {
        // Always display the heritage point adjustment, including zero, to make it explicit
        const heritageDisplay = exportData.heritage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const hPts = exportData.heritagePoints;
        output += `Heritage: ${heritageDisplay} (${hPts > 0 ? '+' : ''}${hPts} pts)\n`;
    }
    output += `Concept: ${exportData.concept}\n`;
    output += `Position: ${exportData.position}\n`;
    output += `Trouble: ${exportData.trouble}\n`;
    output += `Secret: ${exportData.secret}\n\n`;
    
    output += '=== SKILLS ===\n';
    // Build a map of all skill modifiers from extras. This uses the same helper
    // used in the summary to aggregate modifiers across all extras. It
    // returns an object keyed by skill name with an array of modifier
    // objects (value, featureName, extraName).
    const skillModsForExport = getSkillModifiers();
    Object.entries(exportData.skills).forEach(([skill, value]) => {
        const skillNameCap = skill.charAt(0).toUpperCase() + skill.slice(1);
        // Base point cost for the skill (only points above 0 cost anything)
        const baseCost = Math.max(0, value);
        // Gather any modifiers for this skill
        const mods = skillModsForExport[skill] || [];
        let modTotal = 0;
        const modStrings = [];
        mods.forEach(mod => {
            modTotal += mod.value;
            modStrings.push(`${mod.value >= 0 ? '+' : ''}${mod.value} (${mod.featureName} from ${mod.extraName})`);
        });
        const totalValue = value + modTotal;
        // Build line. Always include the base value. If modifiers exist,
        // include the list and the resulting total. Otherwise just show
        // the base value (which is also the total).
        let line = `${skillNameCap}: ${value >= 0 ? '+' : ''}${value}`;
        if (mods.length > 0) {
            line += `, ${modStrings.join(', ')} -> ${totalValue >= 0 ? '+' : ''}${totalValue}`;
        } else if (value !== totalValue) {
            // If base differs from total, show the total
            line += ` -> ${totalValue >= 0 ? '+' : ''}${totalValue}`;
        }
        // Append cost for the base skill value
        if (baseCost > 0) {
            line += ` (${baseCost} pts)`;
        }
        output += line + '\n';
    });
    
    if (exportData.powers.length > 0) {
        output += '\n=== POWERS ===\n';
        exportData.powers.forEach(power => {
            const powerName = power.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            // Retrieve any training modifiers for this power from the aggregated skillMods map.
            const powerMods = (skillModsForExport[power.id] || []);
            let modTotal = 0;
            const modStrings = [];
            powerMods.forEach(mod => {
                modTotal += mod.value;
                modStrings.push(`${mod.value >= 0 ? '+' : ''}${mod.value} (${mod.featureName} from ${mod.extraName})`);
            });
            const modSummary = powerMods.length > 0 ? `${modStrings.join(', ')} -> +${modTotal}` : '';
            if (['dominion', 'essence', 'song'].includes(power.id)) {
                const manualCost = gmPowerCosts[power.id];
                output += `${powerName} (${manualCost || 'GM approval required'} pts)`;
                if (modSummary) {
                    output += ` - ${modSummary}`;
                }
                output += `\n`;
            } else {
                let displayCost = power.cost;
                if (isHeritageFreePower(power.id)) {
                    displayCost = 'Free';
                } else if (power.credit) {
                    let actualCost = power.cost;
                    const credits = power.credit.split(',');
                    credits.forEach(credit => {
                        const [powerName2, creditValue] = credit.split(':');
                        const hasPowerForCredit = exportData.powers.some(p => p.id === powerName2);
                        if (hasPowerForCredit) {
                            actualCost += parseInt(creditValue);
                        }
                    });
                    displayCost = Math.max(0, actualCost);
                }
                output += `${powerName} (${displayCost === 'Free' ? 'Free' : displayCost + ' pts'})`;
                if (modSummary) {
                    output += ` - ${modSummary}`;
                }
                output += `\n`;
            }
        });
    }
    
    if (exportData.extras.length > 0) {
        output += '\n=== EXTRAS ===\n';
        exportData.extras.forEach(extra => {
            const extraName = extra.name || 'Unnamed Extra';
            const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
            const extraCost = calculateExtraCost(extra);
            const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
            
            output += `${extraName}${extraType}${costText}\n`;
            
            if (extra.isSimple) {
                // Output one or more aspects for simple extras
                let aspects = [];
                if (extra.simpleAspects && Array.isArray(extra.simpleAspects) && extra.simpleAspects.length > 0) {
                    aspects = extra.simpleAspects.filter(a => a && a.trim() !== '');
                } else if (extra.simpleAspect) {
                    aspects = [extra.simpleAspect];
                }
                if (aspects.length > 0) {
                    if (aspects.length === 1) {
                        output += `  Aspect: ${aspects[0]}\n`;
                    } else {
                        output += `  Aspects: ${aspects.join(', ')}\n`;
                    }
                }
            } else if (!extra.isSimple && extra.features.length > 0) {
                extra.features.forEach(feature => {
                    // Begin line with feature name
                    let line = `  ${feature.name}`;
                    const fname = feature.name;
                    switch (fname) {
                        case 'Training':
                            if (feature.skill) {
                                const lvl = parseInt(feature.level) || 0;
                                // Display advanced power names with spaces and capital letters
                                const skillDisplay = feature.skill
                                    .replace(/-/g, ' ')
                                    .replace(/\b\w/g, l => l.toUpperCase());
                                line += `: +${lvl} to ${skillDisplay}`;
                            }
                            break;
                        case 'Skilled':
                            if (Array.isArray(feature.skillMods) && feature.skillMods.length > 0) {
                                const mods = feature.skillMods.map(sm => `${sm.skill}(${sm.value >= 0 ? '+' : ''}${sm.value})`).join(', ');
                                line += `: ${mods}`;
                            }
                            break;
                        case 'Focus':
                            if (feature.skill) {
                                const when = feature.circumstance ? ` when ${feature.circumstance}` : '';
                                line += `: +2 to ${feature.skill}${when}`;
                            }
                            break;
                        case 'Flexible':
                            if (feature.skillUsed && feature.skillReplaced) {
                                const when = feature.circumstance ? ` when ${feature.circumstance}` : '';
                                line += `: Use ${feature.skillUsed} for ${feature.skillReplaced}${when}`;
                            }
                            break;
                        case 'Technique':
                            if (feature.ability) {
                                line += `: ${feature.ability}`;
                            }
                            break;
                        case 'Talented':
                        case 'Unusual':
                        case 'Primal Born':
                            if (feature.description) {
                                line += `: ${feature.description}`;
                            }
                            break;
                        default:
                            if (feature.description) {
                                line += `: ${feature.description}`;
                            }
                            break;
                    }
                    output += line + '\n';
                });
            }
        });
    }
    
    output += `\n=== POINT SUMMARY ===\n`;
    output += `Total Available: ${exportData.totalPoints}\n`;
    // Always include the heritage adjustment in the point summary, even when zero
    output += `Heritage Adjustment: ${exportData.heritagePoints > 0 ? '+' : ''}${exportData.heritagePoints}\n`;
    output += `Used: ${exportData.usedPoints}\n`;
    output += `Good Stuff Rating: ${exportData.totalPoints - exportData.usedPoints}\n`;
    
    // Create downloadable file with dynamic naming
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = `Ancient Secrets - ${exportData.characterName || 'Character'} (${exportData.playerName || 'Player'}).txt`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function testLocalStorage() {
    // Test saving and loading functionality
    console.log('Testing localStorage functionality...');
    
    try {
        // Test basic save
        const testData = { test: 'data', timestamp: Date.now() };
        localStorage.setItem('test_amber_save', JSON.stringify(testData));
        
        // Test basic load
        const loaded = JSON.parse(localStorage.getItem('test_amber_save'));
        console.log('Basic save/load test:', loaded.test === 'data' ? 'PASSED' : 'FAILED');
        
        // Test character save
        saveCharacter();
        console.log('Character save test: PASSED');
        
        // Test character load
        const characterData = localStorage.getItem('amberCharacter');
        if (characterData) {
            const parsed = JSON.parse(characterData);
            console.log('Character load test:', parsed ? 'PASSED' : 'FAILED');
            console.log('Extras in save data:', parsed.extras ? parsed.extras.length : 0);
        } else {
            console.log('Character load test: FAILED - No data found');
        }
        
        // Clean up test data
        localStorage.removeItem('test_amber_save');
        
        alert('localStorage test completed. Check console for results.');
        
    } catch (error) {
        console.error('localStorage test failed:', error);
        alert('localStorage test failed: ' + error.message);
    }
}

// Initialize and set up auto-save
document.addEventListener('DOMContentLoaded', function() {
    // Initialize saved characters list and determine current character
    savedCharacters = loadSavedCharacters();
    currentCharacterId = localStorage.getItem('amberCurrentCharacterId') || null;
    // Populate character select dropdown
    populateCharacterSelect();
    // Attach event listeners for character management UI
    const charSelect = document.getElementById('characterSelect');
    if (charSelect) charSelect.addEventListener('change', selectCharacter);
    const newBtn = document.getElementById('newCharacterBtn');
    if (newBtn) newBtn.addEventListener('click', createNewCharacter);
    const importBtn = document.getElementById('importCharacterBtn');
    if (importBtn) importBtn.addEventListener('click', triggerImportCharacter);
    const exportBtn = document.getElementById('exportJsonBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportCharacterJson);
    const deleteBtn = document.getElementById('deleteCharacterBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteCharacter);
    const importFileEl = document.getElementById('importFile');
    if (importFileEl) importFileEl.addEventListener('change', importCharacter);

    // Determine which character to load at startup
    if (savedCharacters.length > 0) {
        // If no currentCharacterId or it doesn't exist in saved list, choose first entry
        if (!currentCharacterId || !savedCharacters.some(entry => entry.id === currentCharacterId)) {
            currentCharacterId = savedCharacters[0].id;
        }
        localStorage.setItem('amberCurrentCharacterId', currentCharacterId);
        // Update select value and load data
        populateCharacterSelect();
        if (charSelect) charSelect.value = currentCharacterId;
        const entry = savedCharacters.find(entry => entry.id === currentCharacterId);
        if (entry && entry.data) {
            loadCharacterData(entry.data);
        }
    } else {
        // No multi-character data. Check legacy single save
        const savedSingle = localStorage.getItem('amberCharacter');
        if (savedSingle) {
            const data = JSON.parse(savedSingle);
            currentCharacterId = Date.now().toString();
            savedCharacters.push({ id: currentCharacterId, data });
            saveSavedCharacters();
            localStorage.setItem('amberCurrentCharacterId', currentCharacterId);
            populateCharacterSelect();
            if (charSelect) charSelect.value = currentCharacterId;
            loadCharacterData(data);
        } else {
            // No saved data at all; create a new character entry with no data
            currentCharacterId = Date.now().toString();
            savedCharacters.push({ id: currentCharacterId, data: null });
            saveSavedCharacters();
            localStorage.setItem('amberCurrentCharacterId', currentCharacterId);
            populateCharacterSelect();
            if (charSelect) charSelect.value = currentCharacterId;
            // Reset UI to defaults
            resetCharacterData();
        }
    }
    // Recalculate points display after loading/initialization
    updatePointsDisplay();

    // Add event listeners for text inputs including name fields for auto-save
    const textInputs = ['characterName', 'playerName', 'concept', 'position', 'trouble', 'secret'];
    textInputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) {
            element.addEventListener('input', saveCharacter);
            element.addEventListener('blur', saveCharacter);
        }
    });
    // Set up auto-save for GM power costs
    const gmPowerIds = ['dominion', 'essence', 'song'];
    gmPowerIds.forEach(powerId => {
        const input = document.getElementById(powerId + '-manual-cost');
        if (input) {
            input.addEventListener('change', () => updateGMPowerCost(powerId));
        }
    });
});