<mxfile host="app.diagrams.net" agent="Antigravity">
  <diagram id="Sequence_Login_Flow" name="Sequence Diagram 2.1 - Login Flow &amp; JWT Auth">
    <mxGraphModel dx="428" dy="235" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="1450" background="#ffffff" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="actor_user" parent="1" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fontStyle=1;fontSize=17;fontFamily=Times New Roman;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;" value="USER" vertex="1">
          <mxGeometry height="55" width="30" x="55" y="30" as="geometry" />
        </mxCell>
        <mxCell id="line_user" edge="1" parent="1" style="edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.2;endArrow=none;fontSize=17;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="70" y="115" as="sourcePoint" />
            <mxPoint x="70" y="1380" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="box_fe" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;fontFamily=Times New Roman;fontSize=17;fontStyle=1;align=center;verticalAlign=middle;" value="Frontend&#xa;(React)" vertex="1">
          <mxGeometry height="45" width="130" x="205" y="40" as="geometry" />
        </mxCell>
        <mxCell id="line_fe" edge="1" parent="1" style="edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.2;endArrow=none;fontSize=17;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="270" y="90" as="sourcePoint" />
            <mxPoint x="270" y="1380" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="box_api" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;fontFamily=Times New Roman;fontSize=17;fontStyle=1;align=center;verticalAlign=middle;" value="API Controller&#xa;(Login View)" vertex="1">
          <mxGeometry height="45" width="140" x="420" y="40" as="geometry" />
        </mxCell>
        <mxCell id="line_api" edge="1" parent="1" style="edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.2;endArrow=none;fontSize=17;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="490" y="90" as="sourcePoint" />
            <mxPoint x="490" y="1380" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="box_biz" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;fontFamily=Times New Roman;fontSize=17;fontStyle=1;align=center;verticalAlign=middle;" value="Auth logic&#xa;(LoginSerializer)" vertex="1">
          <mxGeometry height="45" width="160" x="640" y="40" as="geometry" />
        </mxCell>
        <mxCell id="line_biz" edge="1" parent="1" style="edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.2;endArrow=none;fontSize=17;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720" y="90" as="sourcePoint" />
            <mxPoint x="720" y="1380" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="box_db" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;fontFamily=Times New Roman;fontSize=17;fontStyle=1;align=center;verticalAlign=middle;" value="PostgreSQL&#xa;DB" vertex="1">
          <mxGeometry height="45" width="130" x="895" y="40" as="geometry" />
        </mxCell>
        <mxCell id="line_db" edge="1" parent="1" style="edgeStyle=none;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.2;endArrow=none;fontSize=17;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="960" y="90" as="sourcePoint" />
            <mxPoint x="960" y="1380" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="m1" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=block;" value="Email + Password">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="70" y="130" as="sourcePoint" />
            <mxPoint x="270" y="130" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n1" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="1" vertex="1">
          <mxGeometry height="20" width="20" x="60" y="120" as="geometry" />
        </mxCell>
        <mxCell id="m2" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=block;" value="POST/api/auth/login">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="270" y="170" as="sourcePoint" />
            <mxPoint x="490" y="170" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n2" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="2" vertex="1">
          <mxGeometry height="20" width="20" x="260" y="160" as="geometry" />
        </mxCell>
        <mxCell id="m3" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=block;" value="validate(email, password)">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="490" y="210" as="sourcePoint" />
            <mxPoint x="720" y="210" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n3" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="3" vertex="1">
          <mxGeometry height="20" width="20" x="480" y="200" as="geometry" />
        </mxCell>
        <mxCell id="m4" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=block;" value="filter(email=...)">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720" y="250" as="sourcePoint" />
            <mxPoint x="960" y="250" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n4" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="4" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="240" as="geometry" />
        </mxCell>
        <mxCell id="m5" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=open;" value="">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="960" y="290" as="sourcePoint" />
            <mxPoint x="720" y="290" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n5" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="5" vertex="1">
          <mxGeometry height="20" width="20" x="950" y="280" as="geometry" />
        </mxCell>
        <mxCell id="m6" edge="1" parent="1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=left;verticalAlign=middle;endArrow=block;curved=0;" target="n6" value="check_password()">
          <mxGeometry relative="1" x="0.2222" y="10" as="geometry">
            <mxPoint as="offset" />
            <Array as="points">
              <mxPoint x="760" y="315" />
              <mxPoint x="760" y="335" />
            </Array>
            <mxPoint x="720" y="315" as="sourcePoint" />
            <mxPoint x="720" y="340" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n6" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="6" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="325" as="geometry" />
        </mxCell>
        <mxCell id="frame_alt_invalid" parent="1" style="shape=umlFrame;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=left;verticalAlign=top;width=170;height=30;" value="alt [invalid credentials]" vertex="1">
          <mxGeometry height="180" width="1020" x="20" y="370" as="geometry" />
        </mxCell>
        <mxCell id="m7" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=open;" value="Authentication Failed (401)">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720" y="410" as="sourcePoint" />
            <mxPoint x="490" y="410" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n7" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="7" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="400" as="geometry" />
        </mxCell>
        <mxCell id="m8" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=open;" value="401 &quot;Invalid Email or Password&quot;">
          <mxGeometry relative="1" y="-5" as="geometry">
            <mxPoint as="offset" />
            <mxPoint x="490" y="455" as="sourcePoint" />
            <mxPoint x="270" y="455" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n8" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="8" vertex="1">
          <mxGeometry height="20" width="20" x="480" y="445" as="geometry" />
        </mxCell>
        <mxCell id="m9" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=open;" value="show inline error">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="270" y="500" as="sourcePoint" />
            <mxPoint x="70" y="500" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n9" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="9" vertex="1">
          <mxGeometry height="20" width="20" x="260" y="490" as="geometry" />
        </mxCell>
        <mxCell id="frame_alt_valid" parent="1" style="shape=umlFrame;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=left;verticalAlign=top;width=170;height=40;" value="[valid password]" vertex="1">
          <mxGeometry height="800" width="1020" x="20" y="570" as="geometry" />
        </mxCell>
        <mxCell id="m10" edge="1" parent="1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=left;verticalAlign=middle;endArrow=block;curved=0;" target="n10" value="check_is_active()">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="8" as="offset" />
            <Array as="points">
              <mxPoint x="720.01" y="590.01" />
              <mxPoint x="760.01" y="590.01" />
              <mxPoint x="760.01" y="615" />
            </Array>
            <mxPoint x="720" y="595" as="sourcePoint" />
            <mxPoint x="720" y="620" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n10" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="10" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="605" as="geometry" />
        </mxCell>
        <mxCell id="frame_alt_inactive" parent="1" style="shape=umlFrame;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.2;fontFamily=Times New Roman;fontSize=17;align=left;verticalAlign=top;width=170;height=40;" value="alt [account inactive]" vertex="1">
          <mxGeometry height="180" width="980" x="40" y="640" as="geometry" />
        </mxCell>
        <mxCell id="m11" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=open;" value="PermissionDenied (403)">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720" y="680" as="sourcePoint" />
            <mxPoint x="490" y="680" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n11" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="11" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="670" as="geometry" />
        </mxCell>
        <mxCell id="m12" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=open;" value="403 &quot;Account is disabled&quot;">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="490" y="725" as="sourcePoint" />
            <mxPoint x="270" y="725" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n12" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="12" vertex="1">
          <mxGeometry height="20" width="20" x="480" y="715" as="geometry" />
        </mxCell>
        <mxCell id="m13" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=open;" value="show inline error">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="270" y="770" as="sourcePoint" />
            <mxPoint x="70" y="770" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n13" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="13" vertex="1">
          <mxGeometry height="20" width="20" x="260" y="760" as="geometry" />
        </mxCell>
        <mxCell id="frame_alt_active" parent="1" style="shape=umlFrame;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.2;fontFamily=Times New Roman;fontSize=17;align=left;verticalAlign=top;width=130;height=40;" value="[account active]" vertex="1">
          <mxGeometry height="520" width="980" x="40" y="840" as="geometry" />
        </mxCell>
        <mxCell id="m14" edge="1" parent="1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=left;verticalAlign=middle;endArrow=block;curved=0;" target="n14" value="attach role claim &lt;br&gt;+ fetch permissions">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="8" as="offset" />
            <Array as="points">
              <mxPoint x="760" y="865" />
              <mxPoint x="760" y="890" />
            </Array>
            <mxPoint x="720" y="865" as="sourcePoint" />
            <mxPoint x="720" y="890" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n14" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="14" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="880" as="geometry" />
        </mxCell>
        <mxCell id="m15" edge="1" parent="1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=left;verticalAlign=middle;endArrow=block;curved=0;" target="n15" value="issue access &lt;br&gt;+ refresh JWT">
          <mxGeometry relative="1" x="-0.0016" y="8" as="geometry">
            <mxPoint as="offset" />
            <Array as="points">
              <mxPoint x="760" y="925" />
              <mxPoint x="760" y="950" />
            </Array>
            <mxPoint x="720" y="925" as="sourcePoint" />
            <mxPoint x="720" y="950" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n15" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="15" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="940" as="geometry" />
        </mxCell>
        <mxCell id="m16" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=open;" value="access, refresh, user">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="720" y="990" as="sourcePoint" />
            <mxPoint x="490" y="990" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n16" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="16" vertex="1">
          <mxGeometry height="20" width="20" x="710" y="980" as="geometry" />
        </mxCell>
        <mxCell id="m17" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=open;" value="200 OK">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="490" y="1019.77" as="sourcePoint" />
            <mxPoint x="270" y="1019.77" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n17" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="17" vertex="1">
          <mxGeometry height="20" width="20" x="480" y="1010" as="geometry" />
        </mxCell>
        <mxCell id="m18" edge="1" parent="1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=left;verticalAlign=middle;endArrow=block;innerLoopWaypoints=1;curved=0;" target="n18" value="store tokens&amp;nbsp;&lt;div&gt;(Zustand + persist)&lt;/div&gt;">
          <mxGeometry relative="1" y="8" as="geometry">
            <mxPoint as="offset" />
            <Array as="points">
              <mxPoint x="270" y="1050.02" />
              <mxPoint x="320" y="1050.02" />
              <mxPoint x="320" y="1080.02" />
            </Array>
            <mxPoint x="270" y="1060" as="sourcePoint" />
            <mxPoint x="310" y="1100.0044927536233" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="frame_alt_mustchange" parent="1" style="shape=umlFrame;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.2;fontFamily=Times New Roman;fontSize=17;align=left;verticalAlign=top;width=250;height=40;" value="alt [must_change_password=true]" vertex="1">
          <mxGeometry height="130" width="940" x="60" y="1100" as="geometry" />
        </mxCell>
        <mxCell id="m19" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=16;align=center;verticalAlign=bottom;endArrow=open;" value="redirect /change-password&amp;nbsp;&lt;div&gt;(forced)&lt;/div&gt;">
          <mxGeometry relative="1" as="geometry">
            <mxPoint as="offset" />
            <mxPoint x="270" y="1190" as="sourcePoint" />
            <mxPoint x="70" y="1190" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n19" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="19" vertex="1">
          <mxGeometry height="20" width="20" x="260" y="1200" as="geometry" />
        </mxCell>
        <mxCell id="frame_alt_normal" parent="1" style="shape=umlFrame;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.2;fontFamily=Times New Roman;fontSize=17;align=left;verticalAlign=top;width=230;height=30;" value="[must_change_password=false]" vertex="1">
          <mxGeometry height="100" width="940" x="60" y="1240" as="geometry" />
        </mxCell>
        <mxCell id="m20" edge="1" parent="1" style="edgeStyle=none;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;fontFamily=Times New Roman;fontSize=17;align=center;verticalAlign=bottom;endArrow=open;" value="redirect / (dashboard)">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="270" y="1309.74" as="sourcePoint" />
            <mxPoint x="70" y="1309.74" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="n20" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="20" vertex="1">
          <mxGeometry height="20" width="20" x="260" y="1300" as="geometry" />
        </mxCell>
        <mxCell id="n18" parent="1" style="shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#9E9E9E;strokeColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;fontColor=#ffffff;align=center;verticalAlign=middle;" value="18" vertex="1">
          <mxGeometry height="20" width="20" x="260" y="1070" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
