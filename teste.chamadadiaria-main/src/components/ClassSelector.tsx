
import React from "react";
import { useAttendance } from "@/contexts/AttendanceContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ClassSelector: React.FC = () => {
  const { classes, selectedClass, setSelectedClass } = useAttendance();

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
  };

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-2">Selecione a Turma</h2>
      <Tabs 
        defaultValue={selectedClass || classes[0]?.id} 
        onValueChange={handleClassChange}
        className="w-full"
      >
        <TabsList className="w-full grid grid-flow-col justify-start overflow-x-auto">
          {classes.map((classData) => (
            <TabsTrigger 
              key={classData.id} 
              value={classData.id}
              className="py-2 px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              {classData.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};

export default ClassSelector;
