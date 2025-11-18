/**
 * CategoryManager.jsx
 * Admin interface for managing workflow categories
 */

import React, { useState, useEffect } from 'react';
import { 
    Plus, 
    Edit2, 
    Trash2, 
    Save, 
    X, 
    ChevronRight,
    ChevronDown,
    GripVertical,
    FolderPlus
} from 'lucide-react';
import './CategoryManager.css';

const CategoryManager = () => {
    const [categories, setCategories] = useState([]);
    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [editingCategory, setEditingCategory] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCategory, setNewCategory] = useState({
        name: '',
        parent_id: null,
        icon: '📁',
        description: '',
        sort_order: 0
    });

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const result = await window.electronAPI.categories.getTree();
            if (result.success) {
                setCategories(result.data);
                // Expand all by default
                const allIds = getAllCategoryIds(result.data);
                setExpandedCategories(new Set(allIds));
            }
        } catch (error) {
            console.error('Kategoriler yüklenemedi:', error);
        }
    };

    const getAllCategoryIds = (cats) => {
        let ids = [];
        cats.forEach(cat => {
            ids.push(cat.id);
            if (cat.children && cat.children.length > 0) {
                ids = ids.concat(getAllCategoryIds(cat.children));
            }
        });
        return ids;
    };

    const toggleCategory = (categoryId) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

    const handleCreateCategory = async () => {
        try {
            const result = await window.electronAPI.categories.create(newCategory);
            if (result.success) {
                setShowAddModal(false);
                setNewCategory({
                    name: '',
                    parent_id: null,
                    icon: '📁',
                    description: '',
                    sort_order: 0
                });
                loadCategories();
            }
        } catch (error) {
            console.error('Kategori oluşturulamadı:', error);
            alert('Kategori oluşturulurken hata oluştu!');
        }
    };

    const handleUpdateCategory = async (id, data) => {
        try {
            const result = await window.electronAPI.categories.update(id, data);
            if (result.success) {
                setEditingCategory(null);
                loadCategories();
            }
        } catch (error) {
            console.error('Kategori güncellenemedi:', error);
            alert('Kategori güncellenirken hata oluştu!');
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz? Alt kategoriler ve workflow\'lar üst kategoriye taşınacak.')) {
            return;
        }

        try {
            const result = await window.electronAPI.categories.delete(id);
            if (result.success) {
                loadCategories();
            }
        } catch (error) {
            console.error('Kategori silinemedi:', error);
            alert('Kategori silinirken hata oluştu!');
        }
    };

    const handleAddSubCategory = (parentId) => {
        setNewCategory({
            ...newCategory,
            parent_id: parentId
        });
        setShowAddModal(true);
    };

    const renderCategory = (category, level = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        const isExpanded = expandedCategories.has(category.id);
        const isEditing = editingCategory?.id === category.id;

        return (
            <div key={category.id} className="category-item" style={{ paddingLeft: `${level * 24}px` }}>
                <div className="category-row">
                    <div className="category-left">
                        <GripVertical size={16} className="drag-handle" />
                        
                        {hasChildren && (
                            <button 
                                className="category-toggle-btn"
                                onClick={() => toggleCategory(category.id)}
                            >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                        )}

                        {isEditing ? (
                            <input
                                type="text"
                                className="category-icon-input"
                                value={editingCategory.icon}
                                onChange={(e) => setEditingCategory({...editingCategory, icon: e.target.value})}
                                maxLength={2}
                            />
                        ) : (
                            <span className="category-icon">{category.icon}</span>
                        )}

                        {isEditing ? (
                            <input
                                type="text"
                                className="category-name-input"
                                value={editingCategory.name}
                                onChange={(e) => setEditingCategory({...editingCategory, name: e.target.value})}
                            />
                        ) : (
                            <span className="category-name">{category.name}</span>
                        )}

                        {category.workflow_count > 0 && (
                            <span className="category-workflow-count">
                                {category.workflow_count} workflow
                            </span>
                        )}
                    </div>

                    <div className="category-actions">
                        {isEditing ? (
                            <>
                                <button
                                    className="action-btn save-btn"
                                    onClick={() => handleUpdateCategory(category.id, editingCategory)}
                                    title="Kaydet"
                                >
                                    <Save size={16} />
                                </button>
                                <button
                                    className="action-btn cancel-btn"
                                    onClick={() => setEditingCategory(null)}
                                    title="İptal"
                                >
                                    <X size={16} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    className="action-btn add-sub-btn"
                                    onClick={() => handleAddSubCategory(category.id)}
                                    title="Alt Kategori Ekle"
                                >
                                    <FolderPlus size={16} />
                                </button>
                                <button
                                    className="action-btn edit-btn"
                                    onClick={() => setEditingCategory({...category})}
                                    title="Düzenle"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    className="action-btn delete-btn"
                                    onClick={() => handleDeleteCategory(category.id)}
                                    title="Sil"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {hasChildren && isExpanded && (
                    <div className="category-children">
                        {category.children.map(child => renderCategory(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    const iconOptions = ['📁', '👨‍🎓', '📚', '📊', '⚙️', '📝', '🔍', '✏️', '➕', '🗑️', '📈', '📉', '💼', '🎓', '📋'];

    return (
        <div className="category-manager">
            <div className="category-manager-header">
                <h2>Workflow Kategorileri</h2>
                <button 
                    className="add-category-btn"
                    onClick={() => setShowAddModal(true)}
                >
                    <Plus size={20} />
                    <span>Yeni Kategori</span>
                </button>
            </div>

            <div className="category-list">
                {categories.length === 0 ? (
                    <div className="empty-state">
                        <p>Henüz kategori eklenmemiş.</p>
                        <button onClick={() => setShowAddModal(true)}>İlk Kategoriyi Ekle</button>
                    </div>
                ) : (
                    categories.map(category => renderCategory(category, 0))
                )}
            </div>

            {/* Add Category Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Yeni Kategori Ekle</h3>
                            <button onClick={() => setShowAddModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label>Kategori Adı</label>
                                <input
                                    type="text"
                                    value={newCategory.name}
                                    onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                                    placeholder="Örn: Öğrenci İşlemleri"
                                />
                            </div>

                            <div className="form-group">
                                <label>İkon</label>
                                <div className="icon-picker">
                                    {iconOptions.map(icon => (
                                        <button
                                            key={icon}
                                            className={`icon-option ${newCategory.icon === icon ? 'selected' : ''}`}
                                            onClick={() => setNewCategory({...newCategory, icon})}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Açıklama</label>
                                <textarea
                                    value={newCategory.description}
                                    onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                                    placeholder="Kategori açıklaması..."
                                    rows={3}
                                />
                            </div>

                            <div className="form-group">
                                <label>Üst Kategori</label>
                                <select
                                    value={newCategory.parent_id || ''}
                                    onChange={(e) => setNewCategory({...newCategory, parent_id: e.target.value ? parseInt(e.target.value) : null})}
                                >
                                    <option value="">Ana Kategori</option>
                                    {getAllCategoryIds(categories).map(id => {
                                        const cat = findCategoryById(categories, id);
                                        return cat ? (
                                            <option key={id} value={id}>{cat.name}</option>
                                        ) : null;
                                    })}
                                </select>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button 
                                className="btn-cancel"
                                onClick={() => setShowAddModal(false)}
                            >
                                İptal
                            </button>
                            <button 
                                className="btn-save"
                                onClick={handleCreateCategory}
                                disabled={!newCategory.name}
                            >
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    function findCategoryById(cats, id) {
        for (let cat of cats) {
            if (cat.id === id) return cat;
            if (cat.children) {
                const found = findCategoryById(cat.children, id);
                if (found) return found;
            }
        }
        return null;
    }
};

export default CategoryManager;
