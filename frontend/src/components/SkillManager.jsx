import React, { useState, useEffect } from 'react';
import { skillsAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Edit, CheckCircle, Circle, Save, X, Lightbulb } from 'lucide-react';

const SkillManager = ({ onBack }) => {
  const [skills, setSkills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSkill, setEditingSkill] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', instructions: '', is_active: true });

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    setIsLoading(true);
    try {
      const data = await skillsAPI.getAll();
      setSkills(data);
    } catch (error) {
      console.error('Failed to fetch skills:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({ name: '', description: '', instructions: '', is_active: true });
    setIsCreating(true);
    setEditingSkill(null);
  };

  const handleEdit = (skill) => {
    setFormData({ ...skill });
    setEditingSkill(skill.id);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingSkill(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.instructions) {
      alert("Name and Instructions are required!");
      return;
    }
    
    try {
      if (isCreating) {
        await skillsAPI.create(formData);
      } else {
        await skillsAPI.update(editingSkill, formData);
      }
      handleCancel();
      fetchSkills();
    } catch (error) {
      console.error('Failed to save skill:', error);
      alert('Failed to save skill.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this skill?')) return;
    try {
      await skillsAPI.delete(id);
      fetchSkills();
    } catch (error) {
      console.error('Failed to delete skill:', error);
    }
  };

  const toggleStatus = async (skill) => {
    try {
      await skillsAPI.update(skill.id, { is_active: !skill.is_active });
      fetchSkills();
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  return (
    <div className="flex bg-background h-screen overflow-hidden flex-col">
      <div className="flex items-center gap-4 border-b border-border p-4 bg-card w-full shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back to Chat
        </Button>
        <div className="flex items-center gap-2">
           <Lightbulb className="h-5 w-5 text-yellow-500" />
           <h2 className="text-xl font-semibold text-foreground">AI Skills Manager</h2>
        </div>
      </div>
      
      <div className="p-6 max-w-5xl mx-auto w-full overflow-y-auto">
        {(isCreating || editingSkill) ? (
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-medium">{isCreating ? "Create New Skill" : "Edit Skill"}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Python Expert, Data Analyst"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input 
                  type="text" 
                  value={formData.description || ''}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Short description of what the skill does"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Instructions / Prompt *</label>
                <textarea 
                  value={formData.instructions}
                  onChange={e => setFormData({...formData, instructions: e.target.value})}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-32"
                  placeholder="Detailed instructions for the AI on how to act, code, or format its responses..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={formData.is_active}
                  onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  className="rounded border-gray-300 text-primary"
                />
                <label htmlFor="isActive" className="text-sm">Skill is Active</label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2"/> Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2"/> Save Skill
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">Available Skills</h3>
                <p className="text-sm text-muted-foreground">Add personas or specialized behaviors to your AI Agent.</p>
              </div>
              <Button onClick={handleCreate} className="gap-2">
                <Plus className="w-4 h-4" /> Add Skill
              </Button>
            </div>

            {isLoading ? (
               <div className="flex justify-center p-8 text-muted-foreground">Loading skills...</div>
            ) : skills.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
                  <Lightbulb className="w-12 h-12 mb-4 opacity-20" />
                  <p>No skills added yet.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {skills.map(skill => (
                  <div key={skill.id} className="relative group bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                    <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(skill)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(skill.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 mb-2 pr-16 border-b border-border pb-2">
                      <button onClick={() => toggleStatus(skill)} title={skill.is_active ? "Disable" : "Enable"}>
                        {skill.is_active ? 
                           <CheckCircle className="h-5 w-5 text-green-500 hover:text-green-600 transition-colors" /> : 
                           <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />}
                      </button>
                      <h4 className="font-semibold text-foreground truncate">{skill.name}</h4>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3 flex-grow">
                      {skill.description || 'No description provided.'}
                    </p>
                    
                    <div className="mt-auto px-3 py-2 bg-muted/50 rounded-md">
                       <p className="text-xs font-mono text-muted-foreground line-clamp-2" title={skill.instructions}>
                         {skill.instructions}
                       </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillManager;
