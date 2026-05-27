import React, { useState, useEffect } from 'react';
import WelcomeView from './components/WelcomeView';
import TeacherView from './components/TeacherView';
import StudentView from './components/StudentView';
import ProjectorView from './components/ProjectorView';
import { joinPlayer } from './lib/firebase';

export default function App() {
  const [activeLayout, setActiveLayout] = useState<'welcome' | 'teacher' | 'projector' | 'student'>('welcome');
  const [errorHeader, setErrorHeader] = useState<string | null>(null);

  // Synchronize layout with actual window location pathnames
  useEffect(() => {
    const handleUrlRouting = () => {
      const path = window.location.pathname;
      if (path === '/teacher') {
        setActiveLayout('teacher');
      } else if (path === '/student') {
        setActiveLayout('student');
      } else if (path === '/projector') {
        setActiveLayout('projector');
      } else {
        setActiveLayout('welcome');
      }
    };

    // Run router once on mount
    handleUrlRouting();

    // Setup listener for forward/backward browser keys
    window.addEventListener('popstate', handleUrlRouting);
    return () => window.removeEventListener('popstate', handleUrlRouting);
  }, []);

  // Router navigator
  const navigateTo = (layout: 'welcome' | 'teacher' | 'projector' | 'student') => {
    setActiveLayout(layout);
    const urlMap: Record<string, string> = {
      welcome: '/',
      teacher: '/teacher',
      student: '/student',
      projector: '/projector'
    };
    window.history.pushState({}, '', urlMap[layout] || '/');
  };

  // Direct Join from landing page
  const handleJoinStudentFromWelcome = async (name: string, avatar: string, pin: string) => {
    setErrorHeader(null);
    try {
      // Register player instantly on Firestore or Sandbox server
      const { playerId } = await joinPlayer(pin, name, avatar);
      
      // Store locally so StudentView retrieves it automatically on loading
      localStorage.setItem('school_stud_playerId', playerId);
      localStorage.setItem('school_stud_room_pin', pin);
      localStorage.setItem('school_stud_name', name);
      localStorage.setItem('school_stud_avatar', avatar);

      // Redirect immediately to the student panel
      navigateTo('student');
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || 'خطأ أثناء الدخول، يرجى التحقق من الرقم السري PIN للغرفة.');
    }
  };

  // Render view conditionally according to route
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white pb-12 transition-colors duration-300">
      {activeLayout === 'welcome' && (
        <WelcomeView 
          onJoinStudent={handleJoinStudentFromWelcome} 
          onNavigateToTeacher={() => navigateTo('teacher')}
          onNavigateToProjector={() => navigateTo('projector')}
          onNavigateToStudent={() => navigateTo('student')}
          error={errorHeader}
        />
      )}

      {activeLayout === 'teacher' && (
        <TeacherView 
          onBackToMain={() => navigateTo('welcome')}
        />
      )}

      {activeLayout === 'student' && (
        <StudentView 
          onBackToMain={() => navigateTo('welcome')}
        />
      )}

      {activeLayout === 'projector' && (
        <ProjectorView 
          onBackToMain={() => navigateTo('welcome')}
        />
      )}
    </div>
  );
}
