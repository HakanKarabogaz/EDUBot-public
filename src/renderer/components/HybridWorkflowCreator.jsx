/**
 * HybridWorkflowCreator.jsx
 * Database Integration ile Akıllı Workflow Oluşturma
 */

import React, { useState, useEffect } from 'react';
import './HybridWorkflowCreator.css';

const HybridWorkflowCreator = ({ onBack }) => {
    const [students, setStudents] = useState([]);
    const [courses, setCourses] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState(new Set());
    const [workflowConfig, setWorkflowConfig] = useState({
        name: '',
        description: '',
        targetUrl: '',
        courseFilter: '',
        gradeAction: 'entry', // entry, update, view
        batchSize: 10
    });

    useEffect(() => {
        loadDatabaseData();
    }, []);

    const loadDatabaseData = async () => {
        try {
            // Database'den öğrenci ve ders verilerini yükle
            const studentData = await window.electronAPI.invoke('hybrid:getStudents');
            const courseData = await window.electronAPI.invoke('hybrid:getCourses');
            
            setStudents(studentData || []);
            setCourses(courseData || []);
            setFilteredStudents(studentData || []);
            
            console.log('📊 Database data loaded:', {
                students: studentData?.length || 0,
                courses: courseData?.length || 0
            });
        } catch (error) {
            console.error('❌ Database data load failed:', error);
        }
    };

    const handleCourseFilter = (courseCode) => {
        setWorkflowConfig(prev => ({ ...prev, courseFilter: courseCode }));
        
        if (courseCode === '') {
            setFilteredStudents(students);
        } else {
            // Bu örnekte basit filtreleme - gerçekte enrollments tablosu ile join yapılacak
            const filtered = students.filter(student => 
                // Simülasyon: öğrenci numarasına göre ders filtreleme
                student.student_no && courseCode
            );
            setFilteredStudents(filtered);
        }
    };

    const toggleStudentSelection = (studentId) => {
        const newSelected = new Set(selectedStudents);
        if (newSelected.has(studentId)) {
            newSelected.delete(studentId);
        } else {
            newSelected.add(studentId);
        }
        setSelectedStudents(newSelected);
    };

    const selectAllFiltered = () => {
        if (selectedStudents.size === filteredStudents.length) {
            setSelectedStudents(new Set());
        } else {
            setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
        }
    };

    const createHybridWorkflow = async () => {
        if (!workflowConfig.name || selectedStudents.size === 0) {
            alert('Lütfen workflow adı girin ve en az bir öğrenci seçin!');
            return;
        }

        try {
            const selectedStudentData = filteredStudents.filter(s => 
                selectedStudents.has(s.id)
            );

            const workflowData = {
                name: workflowConfig.name,
                description: `${workflowConfig.description} (${selectedStudents.size} öğrenci)`,
                target_url: workflowConfig.targetUrl,
                timeout: 120000,
                students: selectedStudentData,
                courseFilter: workflowConfig.courseFilter,
                gradeAction: workflowConfig.gradeAction
            };

            console.log('🚀 Creating hybrid workflow:', workflowData);

            const result = await window.electronAPI.invoke('hybrid:createWorkflow', workflowData);
            
            if (result.success) {
                alert(`✅ Hybrid Workflow oluşturuldu!\nWorkflow ID: ${result.workflowId}\nSteps: ${result.stepsCreated}`);
                onBack && onBack();
            } else {
                alert(`❌ Workflow oluşturulamadı: ${result.error}`);
            }

        } catch (error) {
            console.error('❌ Hybrid workflow creation failed:', error);
            alert('❌ Workflow oluşturulurken hata oluştu!');
        }
    };

    return (
        <div className="hybrid-workflow-creator">
            <div className="header">
                <button onClick={onBack} className="back-btn">← Geri</button>
                <h2>🎯 Hybrid Workflow Creator</h2>
                <p>Database verilerinden akıllı workflow oluşturun!</p>
            </div>

            <div className="creator-grid">
                {/* Workflow Config */}
                <div className="config-section">
                    <h3>⚙️ Workflow Konfigürasyonu</h3>
                    
                    <div className="form-group">
                        <label>Workflow Adı:</label>
                        <input 
                            type="text"
                            value={workflowConfig.name}
                            onChange={(e) => setWorkflowConfig(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Örn: YD101 Not Girişi"
                        />
                    </div>

                    <div className="form-group">
                        <label>Açıklama:</label>
                        <input 
                            type="text"
                            value={workflowConfig.description}
                            onChange={(e) => setWorkflowConfig(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Workflow açıklaması"
                        />
                    </div>

                    <div className="form-group">
                        <label>Hedef URL:</label>
                        <input 
                            type="url"
                            value={workflowConfig.targetUrl}
                            onChange={(e) => setWorkflowConfig(prev => ({ ...prev, targetUrl: e.target.value }))}
                            placeholder="https://obs.tarsus.edu.tr/..."
                        />
                    </div>

                    <div className="form-group">
                        <label>İşlem Tipi:</label>
                        <select 
                            value={workflowConfig.gradeAction}
                            onChange={(e) => setWorkflowConfig(prev => ({ ...prev, gradeAction: e.target.value }))}
                        >
                            <option value="entry">Not Girişi</option>
                            <option value="update">Not Güncelleme</option>
                            <option value="view">Not Görüntüleme</option>
                        </select>
                    </div>
                </div>

                {/* Course Filter */}
                <div className="filter-section">
                    <h3>📚 Ders Filtresi</h3>
                    <select 
                        value={workflowConfig.courseFilter}
                        onChange={(e) => handleCourseFilter(e.target.value)}
                    >
                        <option value="">Tüm Dersler</option>
                        {courses.map(course => (
                            <option key={course.id} value={course.course_code}>
                                {course.course_code} - {course.course_name}
                            </option>
                        ))}
                    </select>
                    
                    <div className="filter-stats">
                        <span>📊 Toplam Öğrenci: {filteredStudents.length}</span>
                        <span>✅ Seçili: {selectedStudents.size}</span>
                    </div>
                </div>

                {/* Student Selection */}
                <div className="student-section">
                    <div className="section-header">
                        <h3>👥 Öğrenci Seçimi</h3>
                        <button onClick={selectAllFiltered} className="select-all-btn">
                            {selectedStudents.size === filteredStudents.length ? '❌ Hiçbirini Seçme' : '✅ Tümünü Seç'}
                        </button>
                    </div>
                    
                    <div className="student-list">
                        {filteredStudents.length === 0 ? (
                            <div className="no-data">
                                <p>📭 Henüz öğrenci verisi yok.</p>
                                <p>Önce Hybrid System'den CSV import yapın!</p>
                            </div>
                        ) : (
                            filteredStudents.slice(0, 20).map(student => (
                                <div 
                                    key={student.id} 
                                    className={`student-item ${selectedStudents.has(student.id) ? 'selected' : ''}`}
                                    onClick={() => toggleStudentSelection(student.id)}
                                >
                                    <input 
                                        type="checkbox"
                                        checked={selectedStudents.has(student.id)}
                                        onChange={() => {}}
                                    />
                                    <div className="student-info">
                                        <span className="student-no">{student.student_no}</span>
                                        <span className="student-name">{student.name} {student.surname}</span>
                                    </div>
                                </div>
                            ))
                        )}
                        {filteredStudents.length > 20 && (
                            <div className="more-info">
                                +{filteredStudents.length - 20} öğrenci daha...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="action-section">
                <button 
                    onClick={createHybridWorkflow}
                    disabled={!workflowConfig.name || selectedStudents.size === 0}
                    className="create-workflow-btn"
                >
                    🚀 Hybrid Workflow Oluştur ({selectedStudents.size} öğrenci)
                </button>
            </div>
        </div>
    );
};

export default HybridWorkflowCreator;