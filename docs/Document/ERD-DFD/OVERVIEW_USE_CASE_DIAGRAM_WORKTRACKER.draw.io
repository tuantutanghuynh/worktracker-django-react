<mxfile host="app.diagrams.net" agent="Antigravity AI Assistant">
  <diagram id="WorkTracker_Overview_UseCase" name="WorkTracker Overview Use Case Diagram">
    <mxGraphModel dx="3660" dy="2366" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1050" background="light-dark(#FFFFFF,#5A5A5A)" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="sys_boundary" parent="1" style="rounded=1;whiteSpace=wrap;html=1;arcSize=4;fillColor=#F8FAFC;strokeColor=#475569;strokeWidth=2;dashed=1;verticalAlign=top;fontStyle=1;fontSize=16;fontFamily=Times New Roman;fontColor=#0F172A;" value="&lt;font style=&quot;font-size: 27px;&quot;&gt;WorkTracker Core System (Decoupled Client-Server Architecture)&lt;/font&gt;" vertex="1">
          <mxGeometry height="900" width="1380" x="-250" y="-30" as="geometry" />
        </mxCell>
        <mxCell id="actor_admin" parent="1" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fontStyle=1;fontSize=14;fontFamily=Times New Roman;fillColor=#E2E8F0;strokeColor=#1E293B;strokeWidth=2;" value="Administrator&#xa;(Admin)" vertex="1">
          <mxGeometry height="100" width="60" x="80" y="180" as="geometry" />
        </mxCell>
        <mxCell id="actor_manager" parent="1" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fontStyle=1;fontSize=14;fontFamily=Times New Roman;fillColor=#E2E8F0;strokeColor=#1E293B;strokeWidth=2;" value="Project Manager&#xa;(Manager)" vertex="1">
          <mxGeometry height="100" width="60" x="80" y="620" as="geometry" />
        </mxCell>
        <mxCell id="actor_employee" parent="1" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fontStyle=1;fontSize=14;fontFamily=Times New Roman;fillColor=#E2E8F0;strokeColor=#1E293B;strokeWidth=2;" value="Department Staff&#xa;(Employee)" vertex="1">
          <mxGeometry height="100" width="60" x="970" y="390" as="geometry" />
        </mxCell>
        <mxCell id="uc_01" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;strokeWidth=1.5;" value="UC-01: System Login &amp;&#xa;JWT Authorization" vertex="1">
          <mxGeometry height="60" width="230" x="600" y="150" as="geometry" />
        </mxCell>
        <mxCell id="uc_12" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;strokeWidth=1.5;" value="UC-12: Real-time 1-on-1 &amp;&#xa;Team Chat (WebSockets)" vertex="1">
          <mxGeometry height="60" width="230" x="600" y="280" as="geometry" />
        </mxCell>
        <mxCell id="uc_07" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;" value="UC-07: Interactive Kanban Board&#xa;Progress Tracking" vertex="1">
          <mxGeometry height="60" width="230" x="600" y="460" as="geometry" />
        </mxCell>
        <mxCell id="uc_14" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;" value="UC-14: KPI Performance Reports&#xa;&amp; Export (PDF/Excel)" vertex="1">
          <mxGeometry height="60" width="230" x="190" y="330" as="geometry" />
        </mxCell>
        <mxCell id="uc_02" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;" value="UC-02: User Account &amp;&#xa;RBAC Profile Management" vertex="1">
          <mxGeometry height="55" width="220" x="290" y="50" as="geometry" />
        </mxCell>
        <mxCell id="uc_03" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;" value="UC-03: Department Directory&#xa;Configuration" vertex="1">
          <mxGeometry height="55" width="220" x="290" y="125" as="geometry" />
        </mxCell>
        <mxCell id="uc_04" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;" value="UC-04: Client &amp; Partner&#xa;Directory Management" vertex="1">
          <mxGeometry height="55" width="220" y="440" as="geometry" />
        </mxCell>
        <mxCell id="uc_09" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;" value="UC-09: Timesheet Period Lock&#xa;&amp; Unlock (Time Lock)" vertex="1">
          <mxGeometry height="55" width="220" x="-210" y="370" as="geometry" />
        </mxCell>
        <mxCell id="uc_05" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;" value="UC-05: Core Project (Job)&#xa;Management &amp; Config" vertex="1">
          <mxGeometry height="55" width="220" x="-220" y="665" as="geometry" />
        </mxCell>
        <mxCell id="uc_06" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;" value="UC-06: Create &amp; Assign Tasks&#xa;(Task Breakdown)" vertex="1">
          <mxGeometry height="55" width="220" x="-220" y="530" as="geometry" />
        </mxCell>
        <mxCell id="uc_10" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;strokeWidth=2;" value="UC-10: Task Deliverables QA&#xa;Inspection (Tier-1 Review)" vertex="1">
          <mxGeometry height="55" width="220" x="290" y="680" as="geometry" />
        </mxCell>
        <mxCell id="uc_11" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;strokeWidth=2;" value="UC-11: Timesheet Effort&#xa;Verification (Tier-2 Review)" vertex="1">
          <mxGeometry height="55" width="220" x="290" y="780" as="geometry" />
        </mxCell>
        <mxCell id="uc_08" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;strokeWidth=2;" value="UC-08: Daily Work Hours Logging&#xa;(Log Work Entry)" vertex="1">
          <mxGeometry height="60" width="230" x="885" y="220" as="geometry" />
        </mxCell>
        <mxCell id="uc_13" parent="1" style="ellipse;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fontFamily=Times New Roman;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;" value="UC-13: Real-time Event Notifications&#xa;&amp; Activity Feed" vertex="1">
          <mxGeometry height="60" width="230" x="600" y="585" as="geometry" />
        </mxCell>
        <mxCell id="edge_a_uc1" edge="1" parent="1" source="actor_admin" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_01" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_a_uc12" edge="1" parent="1" source="actor_admin" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_12" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_a_uc2" edge="1" parent="1" source="actor_admin" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_02" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_a_uc3" edge="1" parent="1" source="actor_admin" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_03" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_a_uc4" edge="1" parent="1" source="actor_admin" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_04" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_a_uc9" edge="1" parent="1" source="actor_admin" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_09" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_a_uc14" edge="1" parent="1" source="actor_admin" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_14" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_m_uc1" edge="1" parent="1" source="actor_manager" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_01" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_m_uc12" edge="1" parent="1" source="actor_manager" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_12" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_m_uc4" edge="1" parent="1" source="actor_manager" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_04" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_m_uc9" edge="1" parent="1" source="actor_manager" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_09" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_m_uc5" edge="1" parent="1" source="actor_manager" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_05" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_m_uc6" edge="1" parent="1" source="actor_manager" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_06" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_m_uc10" edge="1" parent="1" source="actor_manager" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_10" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_m_uc11" edge="1" parent="1" source="actor_manager" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_11" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_m_uc7" edge="1" parent="1" source="actor_manager" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_07" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_m_uc13" edge="1" parent="1" source="actor_manager" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_13" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_m_uc14" edge="1" parent="1" source="actor_manager" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_14" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_e_uc1" edge="1" parent="1" source="actor_employee" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_01" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_e_uc12" edge="1" parent="1" source="actor_employee" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_12" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_e_uc7" edge="1" parent="1" source="actor_employee" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_07" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_e_uc8" edge="1" parent="1" source="actor_employee" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_08" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_e_uc13" edge="1" parent="1" source="actor_employee" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_13" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge_e_uc14" edge="1" parent="1" source="actor_employee" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#64748B;rounded=0;" target="uc_14" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
