<mxfile host="app.diagrams.net" agent="Antigravity">
  <diagram id="Sequence_LogWork_Flow_Simple" name="Sequence Diagram 2.2 - Timesheet Entry Flow">
    <mxGraphModel dx="1230" dy="676" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="1450" background="#ffffff" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="actor_user" parent="1" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fontStyle=1;fontSize=16;fontFamily=Times New Roman;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;" value="USER" vertex="1">
          <mxGeometry height="55" width="30" x="55" y="30" as="geometry" />
        </mxCell>
        <mxCell id="line_user" edge="1" parent="1" style="edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.2;endArrow=none;fontSize=16;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="70" y="115" as="sourcePoint" />
            <mxPoint x="70" y="1320" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="box_fe" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;fontFamily=Times New Roman;fontSize=16;fontStyle=1;align=center;verticalAlign=middle;" value="Frontend&#xa;(React)" vertex="1">
          <mxGeometry height="45" width="130" x="205" y="40" as="geometry" />
        </mxCell>
        <mxCell id="line_fe" edge="1" parent="1" style="edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.2;endArrow=none;fontSize=16;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="270" y="80" as="sourcePoint" />
            <mxPoint x="270" y="1320" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="box_api" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;fontFamily=Times New Roman;fontSize=16;fontStyle=1;align=center;verticalAlign=middle;" value="API Controller&#xa;(LogWork View)" vertex="1">
          <mxGeometry height="45" width="140" x="420" y="40" as="geometry" />
        </mxCell>
        <mxCell id="line_api" edge="1" parent="1" style="edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.2;endArrow=none;fontSize=16;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="490" y="80" as="sourcePoint" />
            <mxPoint x="489.13" y="1320" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="box_biz" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;fontFamily=Times New Roman;fontSize=16;fontStyle=1;align=center;verticalAlign=middle;" value="Timesheet Logic&#xa;(LogWorkSerializer)" vertex="1">
          <mxGeometry height="45" width="160" x="640" y="40" as="geometry" />
        </mxCell>
        <mxCell id="line_biz" edge="1" parent="1" style="edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.2;endArrow=none;fontSize=16;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720.0000000000002" y="210" as="sourcePoint" />
            <mxPoint x="720" y="1320" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="box_db" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;fontFamily=Times New Roman;fontSize=16;fontStyle=1;align=center;verticalAlign=middle;" value="PostgreSQL&#xa;DB" vertex="1">
          <mxGeometry height="45" width="130" x="895" y="40" as="geometry" />
        </mxCell>
        <mxCell id="line_db" edge="1" parent="1" source="box_db" style="edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.2;endArrow=none;fontSize=16;exitX=0.5;exitY=1;exitDx=0;exitDy=0;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="960" y="30" as="sourcePoint" />
            <mxPoint x="960" y="1320" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="m1" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=block;" value="Task + Date + Hours + Description">
          <mxGeometry relative="1" y="10" as="geometry">
            <mxPoint as="offset" />
            <mxPoint x="70" y="149.84" as="sourcePoint" />
            <mxPoint x="270" y="149.84" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n1" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="1" vertex="1">
          <mxGeometry height="20" width="20" x="60" y="140" as="geometry" />
        </mxCell>
        <mxCell id="m2" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=block;" value="POST/api/timesheets/logwork">
          <mxGeometry relative="1" y="10" as="geometry">
            <mxPoint as="offset" />
            <mxPoint x="270" y="190" as="sourcePoint" />
            <mxPoint x="490" y="190" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n2" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="2" vertex="1">
          <mxGeometry height="20" width="20" x="260" y="180" as="geometry" />
        </mxCell>
        <mxCell id="m3" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=block;" value="validate(task, date, hours)">
          <mxGeometry relative="1" x="-0.0435" y="10" as="geometry">
            <mxPoint as="offset" />
            <mxPoint x="490" y="219.53" as="sourcePoint" />
            <mxPoint x="720" y="219.53" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n3" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="3" vertex="1">
          <mxGeometry height="20" width="20" x="480" y="209.53" as="geometry" />
        </mxCell>
        <mxCell id="m4" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=block;" value="filter(lock_month=..., lock_year=...)">
          <mxGeometry relative="1" y="10" as="geometry">
            <mxPoint as="offset" />
            <mxPoint x="720" y="259.53" as="sourcePoint" />
            <mxPoint x="960" y="259.53" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="m5" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=open;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="960" y="290" as="sourcePoint" />
            <mxPoint x="720" y="290" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n5" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="5" vertex="1">
          <mxGeometry height="20" width="20" x="950" y="280" as="geometry" />
        </mxCell>
        <mxCell id="m6" edge="1" parent="1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=left;verticalAlign=middle;endArrow=block;curved=0;" target="n6" value="check_time_lock()">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="8" as="offset" />
            <Array as="points">
              <mxPoint x="760" y="315" />
              <mxPoint x="760" y="335" />
            </Array>
            <mxPoint x="720" y="315" as="sourcePoint" />
            <mxPoint x="720" y="340" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n6" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="6" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="325" as="geometry" />
        </mxCell>
        <mxCell id="frame_alt_lock" parent="1" style="shape=umlFrame;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=left;verticalAlign=top;width=130;height=40;" value="alt [period locked]" vertex="1">
          <mxGeometry height="180" width="1020" x="20" y="370" as="geometry" />
        </mxCell>
        <mxCell id="m7" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=open;" value="TimeLockError (403)">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720" y="410" as="sourcePoint" />
            <mxPoint x="490" y="410" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n7" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="7" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="400" as="geometry" />
        </mxCell>
        <mxCell id="m8" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=open;" value="403 &quot;Period is locked&quot;">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="490" y="455" as="sourcePoint" />
            <mxPoint x="270" y="455" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n8" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="8" vertex="1">
          <mxGeometry height="20" width="20" x="480" y="445" as="geometry" />
        </mxCell>
        <mxCell id="m9" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=open;" value="show inline error">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="270" y="500" as="sourcePoint" />
            <mxPoint x="70" y="500" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n9" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="9" vertex="1">
          <mxGeometry height="20" width="20" x="260" y="490" as="geometry" />
        </mxCell>
        <mxCell id="frame_alt_unlocked" parent="1" style="shape=umlFrame;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=left;verticalAlign=top;width=130;height=40;" value="[period unlocked]" vertex="1">
          <mxGeometry height="710" width="1020" x="20" y="570" as="geometry" />
        </mxCell>
        <mxCell id="m10" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=block;" value="get_daily_total(user, date)">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720" y="610" as="sourcePoint" />
            <mxPoint x="960" y="610" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n10" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="10" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="600" as="geometry" />
        </mxCell>
        <mxCell id="m11" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=open;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="960" y="650" as="sourcePoint" />
            <mxPoint x="720" y="650" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n11" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="11" vertex="1">
          <mxGeometry height="20" width="20" x="950" y="640" as="geometry" />
        </mxCell>
        <mxCell id="m12" edge="1" parent="1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=left;verticalAlign=middle;endArrow=block;curved=0;" target="n12" value="check_24h_limit()">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="8" as="offset" />
            <Array as="points">
              <mxPoint x="750" y="675" />
              <mxPoint x="750" y="695" />
            </Array>
            <mxPoint x="720" y="675" as="sourcePoint" />
            <mxPoint x="720" y="700" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n12" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="12" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="685" as="geometry" />
        </mxCell>
        <mxCell id="frame_alt_24h" parent="1" style="shape=umlFrame;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.2;fontFamily=Times New Roman;fontSize=16;align=left;verticalAlign=top;width=150;height=40;" value="alt [daily total &amp;gt; 24h]" vertex="1">
          <mxGeometry height="180" width="980" x="40" y="730" as="geometry" />
        </mxCell>
        <mxCell id="m13" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=open;" value="ValidationError (400)">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720" y="770" as="sourcePoint" />
            <mxPoint x="490" y="770" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n13" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="13" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="760" as="geometry" />
        </mxCell>
        <mxCell id="m14" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=open;" value="400 &quot;Exceeds 24h limit&quot;">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="490" y="815" as="sourcePoint" />
            <mxPoint x="270" y="815" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n14" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="14" vertex="1">
          <mxGeometry height="20" width="20" x="480" y="805" as="geometry" />
        </mxCell>
        <mxCell id="m15" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=open;" value="show inline error">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="270" y="860" as="sourcePoint" />
            <mxPoint x="70" y="860" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n15" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="15" vertex="1">
          <mxGeometry height="20" width="20" x="260" y="850" as="geometry" />
        </mxCell>
        <mxCell id="frame_alt_valid" parent="1" style="shape=umlFrame;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.2;fontFamily=Times New Roman;fontSize=16;align=left;verticalAlign=top;width=140;height=40;" value="[daily total &amp;lt;= 24h]" vertex="1">
          <mxGeometry height="320" width="980" x="40" y="930" as="geometry" />
        </mxCell>
        <mxCell id="m16" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=block;" value="INSERT INTO log_works">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720" y="970" as="sourcePoint" />
            <mxPoint x="960" y="970" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n16" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="16" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="960" as="geometry" />
        </mxCell>
        <mxCell id="m17" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=block;" value="update_daily_timesheet()">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720" y="1020" as="sourcePoint" />
            <mxPoint x="960" y="1020" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n17" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="17" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="1010" as="geometry" />
        </mxCell>
        <mxCell id="m18" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=open;" value="return log_work">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720" y="1070" as="sourcePoint" />
            <mxPoint x="490" y="1070" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n18" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="18" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="1060" as="geometry" />
        </mxCell>
        <mxCell id="m19" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=open;" value="201 &quot;Created&quot;">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="490" y="1120" as="sourcePoint" />
            <mxPoint x="270" y="1120" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n19" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="19" vertex="1">
          <mxGeometry height="20" width="20" x="480" y="1110" as="geometry" />
        </mxCell>
        <mxCell id="m20" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=open;" value="update UI + close modal">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="270" y="1170" as="sourcePoint" />
            <mxPoint x="70" y="1170" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n20" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="20" vertex="1">
          <mxGeometry height="20" width="20" x="260" y="1160" as="geometry" />
        </mxCell>
        <mxCell id="IYjbbG-M_DlgodU2kj0v-1" edge="1" parent="1" style="edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.2;endArrow=none;fontSize=16;" target="n4" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720" y="90" as="sourcePoint" />
            <mxPoint x="720" y="1380" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n4" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=16;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="4" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="250" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
