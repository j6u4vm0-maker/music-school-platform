const fs = require('fs');
const path = require('path');
const file = path.resolve('src/app/schedule/page.tsx');
let content = fs.readFileSync(file, 'utf8');

const destruct = `
  const {
    date, setDate,
    lessons, setLessons,
    viewMode, setViewMode,
    students, teachers, classrooms,
    isLoading,
    isModalOpen, setIsModalOpen,
    isSubmitting,
    selectedRoomIds, toggleRoom, toggleAllRooms,
    selectedTeacherIds, toggleTeacher, toggleAllTeachers,
    editingLessonId, setEditingLessonId,
    draggedLesson,
    formState, setFormState,
    visibleRooms, filteredLessons, hiddenCount, timeSlots,
    shiftDate, getWeekRange, getOverlappingLayout,
    handleDragStart, handleDragEnd, handleDrop,
    openBookingModal, openEditModal,
    handleDeleteLesson, handleBook,
    handleExportExcel
  } = schedule;
`;

content = content.replace('  return (', destruct + '\n  return (');
fs.writeFileSync(file, content);
console.log('Destructuring added successfully.');
